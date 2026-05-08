export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  createdAt: string;
  lastAccessed: string;
  group_id?: string;
  pinned: boolean;
}

export interface TabGroup {
  id: string;
  name: string;
  tabs: Tab[];
  createdAt: string;
  updatedAt: string;
  isLocked: boolean;
  notes?: string;
  isFavorite?: boolean;
  version?: number;
  displayOrder?: number;
}

export type SessionRestoreSource = 'list' | 'search';

export interface TabState {
  groups: TabGroup[];
  activeGroupId: string | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
}

export type LayoutMode = 'single' | 'double';

export type ThemeStyle =
  | 'legacy'
  | 'classic'
  | 'aurora'
  | 'creamy'
  | 'pink'
  | 'mint'
  | 'cyberpunk'
  | 'prism';

export interface UserSettings {
  groupNameTemplate: string;
  showFavicons: boolean;
  showTabCount: boolean;
  confirmBeforeDelete: boolean;
  allowDuplicateTabs: boolean;
  layoutMode: LayoutMode;
  showNotifications: boolean;
  collectPinnedTabs: boolean;
  themeMode: 'light' | 'dark' | 'auto';
  themeStyle?: ThemeStyle;
  reorderMode?: boolean;
}
