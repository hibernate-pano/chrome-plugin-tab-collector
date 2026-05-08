import { createSlice, createAsyncThunk, createSelector, nanoid } from '@reduxjs/toolkit';
import { TabGroup, TabState } from '@/types/tab';
import { storage } from '@/utils/storage';
import { shouldAutoDeleteAfterTabRemoval } from '@/utils/tabGroupUtils';
import { updateDisplayOrder, updateGroupWithVersion } from '@/utils/versionHelper';
import { trackProductEvent } from '@/utils/productEvents';

const initialState: TabState = {
  groups: [],
  activeGroupId: null,
  isLoading: false,
  error: null,
  searchQuery: '',
};

export const loadGroups = createAsyncThunk('tabs/loadGroups', async () => {
  const groups = await storage.getGroups();
  return groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});

export const saveGroup = createAsyncThunk('tabs/saveGroup', async (group: TabGroup) => {
  const groups = await storage.getGroups();
  const nextGroups = [group, ...groups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  await storage.setGroups(nextGroups);
  return group;
});

export const updateGroup = createAsyncThunk('tabs/updateGroup', async (group: TabGroup) => {
  const groups = await storage.getGroups();
  const updatedGroups = groups.map(existing =>
    existing.id === group.id ? updateGroupWithVersion(existing, group) : existing
  );
  await storage.setGroups(updatedGroups);
  return updatedGroups.find(existing => existing.id === group.id)!;
});

export const deleteGroup = createAsyncThunk('tabs/deleteGroup', async (groupId: string) => {
  const groups = await storage.getGroups();
  await storage.setGroups(groups.filter(group => group.id !== groupId));
  return groupId;
});

export const deleteAllGroups = createAsyncThunk('tabs/deleteAllGroups', async () => {
  const groups = await storage.getGroups();
  if (groups.length === 0) {
    return { count: 0 };
  }

  await storage.setGroups([]);
  return { count: groups.length };
});

export const importGroups = createAsyncThunk('tabs/importGroups', async (groups: TabGroup[]) => {
  const processedGroups = groups.map(group => ({
    ...group,
    id: nanoid(),
    tabs: group.tabs.map(tab => ({
      ...tab,
      id: nanoid(),
    })),
  }));

  const existingGroups = await storage.getGroups();
  const nextGroups = [...processedGroups, ...existingGroups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  await storage.setGroups(nextGroups);
  return processedGroups;
});

export const renameGroup = createAsyncThunk(
  'tabs/renameGroup',
  async ({ groupId, name }: { groupId: string; name: string }, { dispatch }) => {
    dispatch(updateGroupName({ groupId, name }));

    const groups = await storage.getGroups();
    const updatedGroups = groups.map(group =>
      group.id === groupId ? updateGroupWithVersion(group, { name }) : group
    );
    await storage.setGroups(updatedGroups);

    const renamedGroup = updatedGroups.find(group => group.id === groupId);
    if (renamedGroup) {
      await trackProductEvent('session_renamed', {
        sessionId: renamedGroup.id,
        sessionName: renamedGroup.name,
      });
    }

    return { groupId, name };
  }
);

export const toggleGroupLockPersisted = createAsyncThunk(
  'tabs/toggleGroupLockPersisted',
  async (groupId: string, { dispatch }) => {
    dispatch(toggleGroupLock(groupId));

    const groups = await storage.getGroups();
    const group = groups.find(item => item.id === groupId);
    if (!group) {
      return { groupId, isLocked: false };
    }

    const updatedGroup = updateGroupWithVersion(group, {
      isLocked: !group.isLocked,
    });
    await storage.setGroups(groups.map(item => (item.id === groupId ? updatedGroup : item)));

    return { groupId, isLocked: updatedGroup.isLocked };
  }
);

export const moveGroupPersisted = createAsyncThunk(
  'tabs/moveGroupPersisted',
  async (
    { dragIndex, hoverIndex }: { dragIndex: number; hoverIndex: number },
    { dispatch }
  ) => {
    dispatch(moveGroup({ dragIndex, hoverIndex }));

    requestAnimationFrame(async () => {
      try {
        const groups = await storage.getGroups();
        if (
          dragIndex < 0 ||
          dragIndex >= groups.length ||
          hoverIndex < 0 ||
          hoverIndex >= groups.length
        ) {
          return;
        }

        const reorderedGroups = [...groups];
        const [dragGroup] = reorderedGroups.splice(dragIndex, 1);
        reorderedGroups.splice(hoverIndex, 0, dragGroup);
        await storage.setGroups(updateDisplayOrder(reorderedGroups));
      } catch (error) {
        console.error('保存会话排序失败:', error);
      }
    });

    return { dragIndex, hoverIndex };
  }
);

export const cleanDuplicateTabs = createAsyncThunk('tabs/cleanDuplicateTabs', async () => {
  let originalGroups: TabGroup[] = [];

  try {
    originalGroups = await storage.getGroups();
    const groups = [...originalGroups];
    const urlMap = new Map<string, { tab: TabGroup['tabs'][number]; groupId: string }[]>();

    groups.forEach(group => {
      group.tabs.forEach(tab => {
        if (!tab.url) {
          return;
        }

        const key = tab.url.startsWith('loading://') ? `${tab.url}|${tab.title}` : tab.url;
        const entries = urlMap.get(key) ?? [];
        entries.push({ tab, groupId: group.id });
        urlMap.set(key, entries);
      });
    });

    let removedTabsCount = 0;
    const updatedGroups = groups.map(group => ({ ...group, tabs: [...group.tabs] }));

    urlMap.forEach(tabsWithSameUrl => {
      if (tabsWithSameUrl.length <= 1) {
        return;
      }

      tabsWithSameUrl.sort(
        (left, right) =>
          new Date(right.tab.lastAccessed).getTime() - new Date(left.tab.lastAccessed).getTime()
      );

      for (let index = 1; index < tabsWithSameUrl.length; index += 1) {
        const { groupId, tab } = tabsWithSameUrl[index];
        const groupIndex = updatedGroups.findIndex(group => group.id === groupId);
        if (groupIndex === -1) {
          continue;
        }

        updatedGroups[groupIndex].tabs = updatedGroups[groupIndex].tabs.filter(
          existing => existing.id !== tab.id
        );
        updatedGroups[groupIndex].updatedAt = new Date().toISOString();
        updatedGroups[groupIndex].version = (updatedGroups[groupIndex].version || 1) + 1;
        removedTabsCount += 1;
      }
    });

    let removedGroupsCount = 0;
    const finalGroups = updatedGroups.filter(group => {
      if (group.tabs.length === 0 && !group.isLocked) {
        removedGroupsCount += 1;
        return false;
      }
      return true;
    });

    await storage.setGroups(finalGroups);

    return {
      removedTabsCount,
      removedGroupsCount,
      updatedGroups: finalGroups,
    };
  } catch (error) {
    console.error('清理重复标签和空会话失败:', error);

    if (originalGroups.length > 0) {
      try {
        await storage.setGroups(originalGroups);
      } catch (rollbackError) {
        console.error('回滚清理结果失败:', rollbackError);
      }
    }

    throw error;
  }
});

export const moveTabPersisted = createAsyncThunk(
  'tabs/moveTabPersisted',
  async (
    {
      sourceGroupId,
      sourceIndex,
      targetGroupId,
      targetIndex,
      updateSourceInDrag = true,
    }: {
      sourceGroupId: string;
      sourceIndex: number;
      targetGroupId: string;
      targetIndex: number;
      updateSourceInDrag?: boolean;
    },
    { dispatch }
  ) => {
    dispatch(moveTab({ sourceGroupId, sourceIndex, targetGroupId, targetIndex }));

    if (!updateSourceInDrag) {
      return { sourceGroupId, sourceIndex, targetGroupId, targetIndex };
    }

    requestAnimationFrame(async () => {
      try {
        const groups = await storage.getGroups();
        const sourceGroup = groups.find(group => group.id === sourceGroupId);
        const targetGroup = groups.find(group => group.id === targetGroupId);

        if (!sourceGroup || !targetGroup) {
          return;
        }

        const tab = sourceGroup.tabs[sourceIndex];
        if (!tab) {
          return;
        }

        const newSourceTabs = [...sourceGroup.tabs];
        const newTargetTabs =
          sourceGroupId === targetGroupId ? newSourceTabs : [...targetGroup.tabs];

        newSourceTabs.splice(sourceIndex, 1);
        const adjustedIndex = Math.max(0, Math.min(targetIndex, newTargetTabs.length));
        newTargetTabs.splice(adjustedIndex, 0, tab);

        const updatedSourceGroup = {
          ...sourceGroup,
          tabs: newSourceTabs,
          updatedAt: new Date().toISOString(),
          version: (sourceGroup.version || 1) + 1,
        };

        const updatedTargetGroup =
          sourceGroupId === targetGroupId
            ? updatedSourceGroup
            : {
                ...targetGroup,
                tabs: newTargetTabs,
                updatedAt: new Date().toISOString(),
                version: (targetGroup.version || 1) + 1,
              };

        let updatedGroups = groups.map(group => {
          if (group.id === sourceGroupId) return updatedSourceGroup;
          if (group.id === targetGroupId) return updatedTargetGroup;
          return group;
        });

        if (
          sourceGroupId !== targetGroupId &&
          updatedSourceGroup.tabs.length === 0 &&
          shouldAutoDeleteAfterTabRemoval(updatedSourceGroup, '')
        ) {
          updatedGroups = updatedGroups.filter(group => group.id !== sourceGroupId);
          setTimeout(() => {
            void dispatch(deleteGroup(sourceGroupId));
          }, 100);
        }

        await storage.setGroups(updatedGroups);
      } catch (error) {
        console.error('保存标签页拖拽结果失败:', error);
      }
    });

    return { sourceGroupId, sourceIndex, targetGroupId, targetIndex };
  }
);

export const tabSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    setActiveGroup: (state, action) => {
      state.activeGroupId = action.payload;
    },
    updateGroupName: (state, action) => {
      const { groupId, name } = action.payload;
      const group = state.groups.find(item => item.id === groupId);
      if (group) {
        group.name = name;
        group.version = (group.version || 1) + 1;
        group.updatedAt = new Date().toISOString();
      }
    },
    toggleGroupLock: (state, action) => {
      const group = state.groups.find(item => item.id === action.payload);
      if (group) {
        group.isLocked = !group.isLocked;
        group.version = (group.version || 1) + 1;
        group.updatedAt = new Date().toISOString();
      }
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    moveGroup: (state, action) => {
      const { dragIndex, hoverIndex } = action.payload;
      const reorderedGroups = [...state.groups];
      const [dragGroup] = reorderedGroups.splice(dragIndex, 1);
      reorderedGroups.splice(hoverIndex, 0, dragGroup);
      state.groups = reorderedGroups;
    },
    moveTab: (state, action) => {
      const { sourceGroupId, sourceIndex, targetGroupId, targetIndex } = action.payload;
      const sourceGroup = state.groups.find(group => group.id === sourceGroupId);
      const targetGroup = state.groups.find(group => group.id === targetGroupId);

      if (!sourceGroup || !targetGroup) {
        return;
      }

      if (sourceIndex < 0 || sourceIndex >= sourceGroup.tabs.length) {
        return;
      }

      const tab = { ...sourceGroup.tabs[sourceIndex] };
      const now = new Date().toISOString();

      if (sourceGroupId === targetGroupId) {
        const newTabs = [...sourceGroup.tabs];
        newTabs.splice(sourceIndex, 1);
        newTabs.splice(Math.max(0, Math.min(targetIndex, newTabs.length)), 0, tab);

        state.groups = state.groups.map(group =>
          group.id === sourceGroupId
            ? {
                ...group,
                tabs: newTabs,
                updatedAt: now,
              }
            : group
        );
        return;
      }

      const newSourceTabs = sourceGroup.tabs.filter((_, index) => index !== sourceIndex);
      const newTargetTabs = [...targetGroup.tabs];
      const existingIndex = newTargetTabs.findIndex(existing => existing.id === tab.id);
      if (existingIndex !== -1) {
        newTargetTabs.splice(existingIndex, 1);
      }
      newTargetTabs.splice(Math.max(0, Math.min(targetIndex, newTargetTabs.length)), 0, tab);

      state.groups = state.groups.map(group => {
        if (group.id === sourceGroupId) {
          return {
            ...group,
            tabs: newSourceTabs,
            updatedAt: now,
          };
        }

        if (group.id === targetGroupId) {
          return {
            ...group,
            tabs: newTargetTabs,
            updatedAt: now,
          };
        }

        return group;
      });
    },
    setGroups: (state, action) => {
      state.groups = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadGroups.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groups = action.payload;
      })
      .addCase(loadGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '加载会话失败';
      })
      .addCase(saveGroup.fulfilled, (state, action) => {
        state.groups.unshift(action.payload);
        state.groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      })
      .addCase(updateGroup.fulfilled, (state, action) => {
        const index = state.groups.findIndex(group => group.id === action.payload.id);
        if (index !== -1) {
          state.groups[index] = action.payload;
        }
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.groups = state.groups.filter(group => group.id !== action.payload);
        if (state.activeGroupId === action.payload) {
          state.activeGroupId = null;
        }
      })
      .addCase(deleteAllGroups.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAllGroups.fulfilled, state => {
        state.isLoading = false;
        state.groups = [];
        state.activeGroupId = null;
      })
      .addCase(deleteAllGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '删除所有会话失败';
      })
      .addCase(cleanDuplicateTabs.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cleanDuplicateTabs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groups = action.payload.updatedGroups;
      })
      .addCase(cleanDuplicateTabs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '清理重复标签和空会话失败';
      });
  },
});

export const {
  setActiveGroup,
  updateGroupName,
  toggleGroupLock,
  setSearchQuery,
  moveGroup,
  moveTab,
  setGroups,
} = tabSlice.actions;

export const deleteTab = createAsyncThunk<
  { group: TabGroup | null },
  { groupId: string; tabId: string }
>('tabs/deleteTab', async ({ groupId, tabId }) => {
  const groups = await storage.getGroups();
  const groupIndex = groups.findIndex(group => group.id === groupId);

  if (groupIndex === -1) {
    return { group: null };
  }

  const currentGroup = groups[groupIndex];
  if (shouldAutoDeleteAfterTabRemoval(currentGroup, tabId)) {
    await storage.setGroups(groups.filter(group => group.id !== groupId));
    return { group: null };
  }

  const updatedGroup = {
    ...currentGroup,
    tabs: currentGroup.tabs.filter(tab => tab.id !== tabId),
    updatedAt: new Date().toISOString(),
    version: (currentGroup.version || 1) + 1,
  };

  const updatedGroups = [...groups];
  updatedGroups[groupIndex] = updatedGroup;
  await storage.setGroups(updatedGroups);

  return { group: updatedGroup };
});

export const selectFilteredGroups = createSelector(
  [
    (state: { tabs: TabState }) => state.tabs.groups,
    (state: { tabs: TabState }) => state.tabs.searchQuery,
  ],
  (groups, searchQuery) => {
    if (!searchQuery) {
      return groups;
    }

    const query = searchQuery.toLowerCase();
    return groups.filter(group => {
      if (group.name.toLowerCase().includes(query)) return true;
      if (group.notes?.toLowerCase().includes(query)) return true;
      return group.tabs.some(
        tab => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)
      );
    });
  }
);

export default tabSlice.reducer;
