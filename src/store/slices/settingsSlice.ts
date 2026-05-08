import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserSettings, LayoutMode, ThemeStyle } from '@/types/tab';
import { storage, DEFAULT_SETTINGS as defaultSettings } from '@/utils/storage';

const initialState: UserSettings = {
  ...defaultSettings,
  reorderMode: false,
};

export const loadSettings = createAsyncThunk('settings/loadSettings', async () => {
  return await storage.getSettings();
});

export const saveSettings = createAsyncThunk<UserSettings, void, { state: { settings: UserSettings } }>(
  'settings/saveSettings',
  async (_, { getState }) => {
    const { settings } = getState();
    await storage.setSettings(settings);
    return settings;
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings: (state, action: PayloadAction<Partial<UserSettings>>) => {
      return { ...state, ...action.payload };
    },
    setThemeMode: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.themeMode = action.payload;
    },
    setThemeStyle: (state, action: PayloadAction<ThemeStyle>) => {
      state.themeStyle = action.payload;
    },
    setShowFavicons: (state, action: PayloadAction<boolean>) => {
      state.showFavicons = action.payload;
    },
    setShowTabCount: (state, action: PayloadAction<boolean>) => {
      state.showTabCount = action.payload;
    },
    setShowNotifications: (state, action: PayloadAction<boolean>) => {
      state.showNotifications = action.payload;
    },
    setGroupNameTemplate: (state, action: PayloadAction<string>) => {
      state.groupNameTemplate = action.payload;
    },
    toggleShowFavicons: state => {
      state.showFavicons = !state.showFavicons;
    },
    toggleConfirmBeforeDelete: state => {
      state.confirmBeforeDelete = !state.confirmBeforeDelete;
    },
    toggleAllowDuplicateTabs: state => {
      state.allowDuplicateTabs = !state.allowDuplicateTabs;
    },
    toggleShowNotifications: state => {
      state.showNotifications = !state.showNotifications;
    },
    toggleCollectPinnedTabs: state => {
      state.collectPinnedTabs = !state.collectPinnedTabs;
    },
    setLayoutMode: (state, action: PayloadAction<LayoutMode>) => {
      state.layoutMode = action.payload;
    },
    toggleLayoutMode: state => {
      state.layoutMode = state.layoutMode === 'single' ? 'double' : 'single';
    },
    setReorderMode(state, action: PayloadAction<boolean>) {
      state.reorderMode = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadSettings.fulfilled, (_, action) => action.payload)
      .addCase(saveSettings.fulfilled, (_, action) => action.payload);
  },
});

export const {
  updateSettings,
  setThemeMode,
  setThemeStyle,
  setShowFavicons,
  setShowTabCount,
  setShowNotifications,
  setGroupNameTemplate,
  toggleShowFavicons,
  toggleConfirmBeforeDelete,
  toggleAllowDuplicateTabs,
  toggleShowNotifications,
  toggleCollectPinnedTabs,
  setLayoutMode,
  toggleLayoutMode,
  setReorderMode,
} = settingsSlice.actions;

export default settingsSlice.reducer;
