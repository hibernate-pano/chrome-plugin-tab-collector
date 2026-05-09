import { TabGroup, UserSettings, LayoutMode } from '@/types/tab';
import { parseOneTabFormat, formatToOneTabFormat } from './oneTabFormatParser';
import { kvGet, kvSet, kvRemove } from '@/storage/storageAdapter';
import { cacheManager, cachedAsyncFn, debounceAsync } from './performance';
import {
  normalizeStoredSettings,
  validateThemeMode,
  validateThemeStyle,
} from './settingsNormalization';

// 缓存 TTL 配置常量
export const CACHE_TTL = {
  GROUPS: 30 * 1000,    // 30秒
  SETTINGS: 60 * 1000,  // 60秒
} as const;

/**
 * 使标签组缓存失效，下次 getGroups() 会从 chrome.storage 重新读取。
 * 在后台保存/收集标签页后，由标签管理器页面在刷新前调用，避免读到旧缓存。
 */
export function invalidateGroupsCache(): void {
  cacheManager.getCache('storage').delete('groups');
}

const STORAGE_KEYS = {
  VERSION: 'storage_version',
  GROUPS: 'tab_groups',
  SETTINGS: 'user_settings',
  PRODUCT_EVENTS: 'product_events',
  MIGRATION_FLAGS: 'migration_flags'
};

const STORAGE_VERSION = 2;

// 默认设置
export const DEFAULT_SETTINGS: UserSettings = {
  groupNameTemplate: 'Group %d',
  showFavicons: true,
  showTabCount: true,
  confirmBeforeDelete: true,
  allowDuplicateTabs: false,
  layoutMode: 'single' as LayoutMode,
  showNotifications: false,
  themeMode: 'auto',
  themeStyle: 'workbench',
  collectPinnedTabs: false,
};

// 导出数据的格式
interface ExportData {
  version: string;
  timestamp: string;
  data: {
    groups: TabGroup[];
    settings: UserSettings;
  };
}

class ChromeStorage {
  private async ensureVersion() {
    const version = await kvGet<number>(STORAGE_KEYS.VERSION);
    if (version === STORAGE_VERSION) return;
    await kvSet(STORAGE_KEYS.VERSION, STORAGE_VERSION);
  }

  async getGroups(): Promise<TabGroup[]> {
    try {
      return await cachedAsyncFn('storage', 'groups', async () => {
        await this.ensureVersion();
        const groups = await kvGet<unknown>(STORAGE_KEYS.GROUPS);
        return Array.isArray(groups) ? (groups as TabGroup[]) : [];
      }, CACHE_TTL.GROUPS);
    } catch (error) {
      console.error('获取标签组失败:', error);
      return [];
    }
  }

  /**
   * 防抖批量写入 groups（可 await）
   * - 窗口期内多次 setGroups 会合并为一次落盘（使用最后一次 groups）
   * - 但每次调用都可以 await，保证返回时已真正写入
   */
  private debouncedPersistGroups = debounceAsync(async (groups: TabGroup[]) => {
    await this.ensureVersion();
    await kvSet(STORAGE_KEYS.GROUPS, groups);

    // 落盘后刷新缓存 TTL（即便之前已 optimistic 更新）
    const cache = cacheManager.getCache('storage');
    cache.set('groups', groups, CACHE_TTL.GROUPS);
  }, 500);

  async setGroups(groups: TabGroup[]): Promise<void> {
    const cache = cacheManager.getCache('storage');
    
    try {
      // optimistic：立刻更新缓存，保证后续读取一致
      // 注意：在防抖窗口期内，缓存会被多次更新，但最终只有最后一次会持久化
      cache.set('groups', groups, CACHE_TTL.GROUPS);

      // 强一致：等待最终一次落盘完成
      await this.debouncedPersistGroups(groups);
    } catch (error) {
      console.error('保存标签组失败:', error);
      // 清除可能不一致的缓存
      cache.delete('groups');
      throw error;
    }
  }

  async getSettings(): Promise<UserSettings> {
    try {
      return await cachedAsyncFn('storage', 'settings', async () => {
        await this.ensureVersion();
        const rawSettings = await kvGet<unknown>(STORAGE_KEYS.SETTINGS);
        const { settings, needsRewrite } = normalizeStoredSettings(rawSettings, DEFAULT_SETTINGS);

        if (needsRewrite) {
          await this.setSettings(settings);
        }

        return settings;
      }, CACHE_TTL.SETTINGS);
    } catch (error) {
      console.error('获取设置失败:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * 防抖批量写入 settings（可 await）
   * - 窗口期内多次 setSettings 会合并为一次落盘（使用最后一次 settings）
   * - 每次调用都可以 await，保证返回时已真正写入
   */
  private debouncedPersistSettings = debounceAsync(async (settings: UserSettings) => {
    await this.ensureVersion();

    // 验证主题相关设置，确保保存的值是有效的
    const validatedSettings: UserSettings = {
      ...settings,
      themeStyle: validateThemeStyle(settings.themeStyle),
      themeMode: validateThemeMode(settings.themeMode),
    };

    await kvSet(STORAGE_KEYS.SETTINGS, validatedSettings);

    // 落盘后刷新缓存 TTL（即便之前已 optimistic 更新）
    const cache = cacheManager.getCache('storage');
    cache.set('settings', validatedSettings, CACHE_TTL.SETTINGS);
  }, 500);

  async setSettings(settings: UserSettings): Promise<void> {
    const validatedSettings: UserSettings = {
      ...settings,
      themeStyle: validateThemeStyle(settings.themeStyle),
      themeMode: validateThemeMode(settings.themeMode),
    };

    const cache = cacheManager.getCache('storage');

    try {
      // optimistic：立刻更新缓存，保证后续读取一致
      // 注意：在防抖窗口期内，缓存会被多次更新，但最终只有最后一次会持久化
      cache.set('settings', validatedSettings, CACHE_TTL.SETTINGS);

      // 强一致：等待最终一次落盘完成
      await this.debouncedPersistSettings(validatedSettings);
    } catch (error) {
      console.error('保存设置失败:', error);
      // 清除可能不一致的缓存
      cache.delete('settings');
      throw error;
    }
  }

  async getProductEvents(): Promise<Array<Record<string, unknown>>> {
    try {
      await this.ensureVersion();
      const events = await kvGet<unknown>(STORAGE_KEYS.PRODUCT_EVENTS);
      return Array.isArray(events) ? (events as Array<Record<string, unknown>>) : [];
    } catch (error) {
      console.error('获取产品事件失败:', error);
      return [];
    }
  }

  async appendProductEvent(event: Record<string, unknown>): Promise<void> {
    const events = await this.getProductEvents();
    const nextEvents = [...events, event].slice(-200);
    await kvSet(STORAGE_KEYS.PRODUCT_EVENTS, nextEvents);
  }

  async clearProductEvents(): Promise<void> {
    await kvRemove(STORAGE_KEYS.PRODUCT_EVENTS);
  }

  async exportData(): Promise<ExportData> {
    const groups = await this.getGroups();
    const settings = await this.getSettings();

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        groups,
        settings,
      }
    };
  }

  /**
   * 导出为 OneTab 格式
   * @returns OneTab 格式的导出文本
   */
  async exportToOneTabFormat(): Promise<string> {
    const groups = await this.getGroups();
    return formatToOneTabFormat(groups);
  }

  async importData(data: ExportData): Promise<boolean> {
    try {
      if (!data || !data.data || !Array.isArray(data.data.groups)) {
        throw new Error('无效的导入数据格式');
      }

      // 导入标签组，并按创建时间倒序排列
      const existingGroups = await this.getGroups();
      const allGroups = [...data.data.groups, ...existingGroups];
      // 按创建时间倒序排列，确保最新创建的标签组在前面
      const sortedGroups = allGroups.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      await this.setGroups(sortedGroups);

      // 如果有设置数据，则合并设置
      if (data.data.settings) {
        const currentSettings = await this.getSettings();
        await this.setSettings({
          ...currentSettings,
          ...data.data.settings
        });
      }
      return true;
    } catch (error) {
      console.error('导入数据失败:', error);
      return false;
    }
  }

  /**
   * 从 OneTab 格式导入数据
   * @param text OneTab 格式的文本
   * @returns 是否导入成功
   */
  async importFromOneTabFormat(text: string): Promise<boolean> {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('无效的 OneTab 导入数据');
      }

      // 解析 OneTab 格式的文本
      const parsedGroups = parseOneTabFormat(text);

      if (parsedGroups.length === 0) {
        throw new Error('解析失败或没有有效的标签组');
      }

      // 导入标签组，并按创建时间倒序排列
      const existingGroups = await this.getGroups();
      const allGroups = [...parsedGroups, ...existingGroups];
      // 按创建时间倒序排列，确保最新创建的标签组在前面
      const sortedGroups = allGroups.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      await this.setGroups(sortedGroups);

      return true;
    } catch (error) {
      console.error('从 OneTab 格式导入数据失败:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = [
        STORAGE_KEYS.VERSION,
        STORAGE_KEYS.GROUPS,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.PRODUCT_EVENTS,
        STORAGE_KEYS.MIGRATION_FLAGS
      ];
      await Promise.all(keys.map(key => kvRemove(key)));
    } catch (error) {
      console.error('清除存储失败:', error);
    }
  }

  // 迁移标志相关方法
  async getMigrationFlags(): Promise<Record<string, boolean>> {
    try {
      const result = await kvGet<Record<string, boolean>>(STORAGE_KEYS.MIGRATION_FLAGS);
      if (result) {
        return result;
      }

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const legacyResult = await chrome.storage.local.get([STORAGE_KEYS.MIGRATION_FLAGS]);
        const legacyFlags = legacyResult[STORAGE_KEYS.MIGRATION_FLAGS];

        if (legacyFlags && typeof legacyFlags === 'object') {
          await kvSet(STORAGE_KEYS.MIGRATION_FLAGS, legacyFlags as Record<string, boolean>);
          await chrome.storage.local.remove(STORAGE_KEYS.MIGRATION_FLAGS);
          return legacyFlags as Record<string, boolean>;
        }
      }

      return {};
    } catch (error) {
      console.error('获取迁移标志失败:', error);
      return {};
    }
  }

  async setMigrationFlag(key: string, value: boolean): Promise<void> {
    try {
      const flags = await this.getMigrationFlags();
      flags[key] = value;
      await kvSet(STORAGE_KEYS.MIGRATION_FLAGS, flags);
    } catch (error) {
      console.error('设置迁移标志失败:', error);
    }
  }
}

export const storage = new ChromeStorage();
