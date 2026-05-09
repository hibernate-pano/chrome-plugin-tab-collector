import React, { useState, useTransition } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  toggleLayoutMode,
  saveSettings,
  setReorderMode,
  updateSettings,
} from '@/store/slices/settingsSlice';
import { cleanDuplicateTabs } from '@/store/slices/tabSlice';
import { HeaderDropdown } from './HeaderDropdown';
import { useToast } from '@/contexts/ToastContext';
import { TabCounter } from './TabCounter';
import { SimpleThemeToggle } from './SimpleThemeToggle';
import { LayoutMode } from '@/types/tab';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { Tooltip } from '@/components/common/Tooltip';
import { TabVaultIcon } from '@/components/common/TabVaultIcon';

interface HeaderProps {
  onSearch: (query: string) => void;
}

const LoadingIcon = () => (
  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LayoutSingleIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const LayoutDoubleIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h7.5M3.75 12h7.5m-7.5 5.25h7.5m4.5-10.5h4.5m-4.5 5.25h4.5m-4.5 5.25h4.5" />
  </svg>
);

const CleanIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const MenuIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
  </svg>
);

const SaveIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const dispatch = useAppDispatch();
  const { showConfirm, showAlert } = useToast();
  const settings = useAppSelector(state => state.settings);

  const { searchValue, debouncedValue, handleSearchChange, clearSearch, isSearching } =
    useDebouncedSearch();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchTransitionPending, startSearchTransition] = useTransition();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleCleanDuplicateTabs = () => {
    showConfirm({
      title: '确认清理重复标签和空会话',
      message:
        '此操作将：\n• 清理所有会话中 URL 相同的重复标签页，只保留每个 URL 最新的一个标签页\n• 自动删除不包含任何标签页的空会话（锁定的会话除外）\n此操作不可撤销。',
      type: 'warning',
      confirmText: '确认清理',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          const result = await dispatch(cleanDuplicateTabs()).unwrap();
          let message = '清理完成';
          if (result.removedTabsCount > 0 || result.removedGroupsCount > 0) {
            const details = [];
            if (result.removedTabsCount > 0) {
              details.push(`已清理 ${result.removedTabsCount} 个重复标签页`);
            }
            if (result.removedGroupsCount > 0) {
              details.push(`已删除 ${result.removedGroupsCount} 个空会话`);
            }
            message = `清理完成\n${details.join('\n')}`;
          } else {
            message = '清理完成，未发现重复标签页或空会话';
          }
          showAlert({
            title: '清理完成',
            message,
            type: 'success',
            onClose: () => {},
          });
        } catch (error) {
          console.error('清理重复标签失败:', error);
          showAlert({
            title: '清理失败',
            message: '清理重复标签失败，请重试',
            type: 'error',
            onClose: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  const handleToggleLayout = () => {
    if (settings.reorderMode) {
      dispatch(setReorderMode(false));
    }
    dispatch(toggleLayoutMode());

    let nextLayoutMode: LayoutMode;
    switch (settings.layoutMode) {
      case 'single':
        nextLayoutMode = 'double';
        break;
      case 'double':
        nextLayoutMode = 'single';
        break;
      default:
        nextLayoutMode = 'single';
    }

    dispatch(
      updateSettings({
        layoutMode: nextLayoutMode,
        reorderMode: false,
      })
    );
    dispatch(saveSettings() as any);
  };

  const handleSaveAllTabs = async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const windowId = tabs[0]?.windowId;
    chrome.runtime.sendMessage({
      type: 'SAVE_ALL_TABS',
      data: { windowId },
    });
  };

  useKeyboardShortcuts([
    { ...COMMON_SHORTCUTS.SAVE_TABS, action: handleSaveAllTabs },
    { ...COMMON_SHORTCUTS.SEARCH, action: () => searchInputRef.current?.focus() },
    { ...COMMON_SHORTCUTS.CLEAR_SEARCH, action: () => { if (searchValue) clearSearch(); } },
    { ...COMMON_SHORTCUTS.TOGGLE_LAYOUT, action: handleToggleLayout },
    { ...COMMON_SHORTCUTS.CLEAN_DUPLICATES, action: handleCleanDuplicateTabs },
  ]);

  const getContainerWidthClass = () => 'layout-double-width';

  React.useEffect(() => {
    startSearchTransition(() => {
      onSearch(debouncedValue);
    });
  }, [debouncedValue, onSearch]);

  const isSearchBusy = isSearching || isSearchTransitionPending;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSearchChange(e.target.value);
  };

  const handleClearSearch = () => {
    clearSearch();
  };

  const handleResetToDefaultView = () => {
    clearSearch();
    if (settings.reorderMode) {
      dispatch(setReorderMode(false));
      dispatch(saveSettings() as any);
    }
  };

  return (
    <header className="header">
      <div className={`w-full px-4 py-3 sm:px-6 ${getContainerWidthClass()}`}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <button
              onClick={handleResetToDefaultView}
              className="group flex min-w-0 items-center gap-2.5 rounded-lg text-left flat-interaction"
              title="回到默认视图"
              aria-label="回到默认视图"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
                <TabVaultIcon size={16} />
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  Tag Collector
                </span>
                <span className="hidden rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] sm:inline-flex">
                  本地
                </span>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <TabCounter />

              <Tooltip content="保存当前窗口为会话" position="bottom">
                <button
                  onClick={handleSaveAllTabs}
                  className="btn btn-primary flat-interaction hidden h-9 whitespace-nowrap px-4 text-sm lg:inline-flex"
                  aria-label="保存当前窗口中的所有标签页为会话"
                >
                  <SaveIcon />
                  <span>保存窗口</span>
                </button>
                <button
                  onClick={handleSaveAllTabs}
                  className="btn btn-primary flat-interaction h-9 px-4 text-sm lg:hidden"
                  aria-label="保存当前窗口中的所有标签页为会话"
                >
                  <SaveIcon />
                  <span>保存会话</span>
                </button>
              </Tooltip>

              <Tooltip
                content={settings.layoutMode === 'single' ? '切换双栏布局' : '切换单栏布局'}
                position="bottom"
              >
                <button
                  onClick={handleToggleLayout}
                  className="btn-icon flat-interaction"
                  aria-label={settings.layoutMode === 'single' ? '切换为双栏布局' : '切换为单栏布局'}
                >
                  {settings.layoutMode === 'single' ? <LayoutSingleIcon /> : <LayoutDoubleIcon />}
                </button>
              </Tooltip>

              <Tooltip content="清理重复标签" position="bottom">
                <button
                  onClick={handleCleanDuplicateTabs}
                  className="btn-icon flat-interaction"
                  aria-label="清理重复标签页"
                >
                  <CleanIcon />
                </button>
              </Tooltip>

              <SimpleThemeToggle />

              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="btn-icon flat-interaction"
                  aria-label="菜单"
                >
                  <MenuIcon />
                </button>
                {showDropdown && <HeaderDropdown onClose={() => setShowDropdown(false)} />}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 search-icon">
                {isSearchBusy ? <LoadingIcon /> : <SearchIcon />}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索会话、备注、域名或标签标题"
                className="input search-input h-10 w-full pl-10 pr-20 text-sm"
                onChange={handleSearch}
                value={searchValue}
                aria-label="搜索会话、备注或标签页"
                role="searchbox"
                autoComplete="off"
                aria-busy={isSearchBusy}
              />
              {!searchValue && (
                <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] xl:block">
                  Ctrl+F
                </div>
              )}
              {searchValue && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 search-clear-btn flat-interaction transition-colors"
                  title="清空搜索"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
