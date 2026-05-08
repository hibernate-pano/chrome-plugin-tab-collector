import { initStorage, kvRemove } from '@/storage/storageAdapter';
import type { TabGroup } from '@/types/tab';
import { sanitizeFaviconUrl } from './faviconUtils';
import { storage } from './storage';
import { initializeVersionFields } from './versionHelper';

let localDataReadyPromise: Promise<void> | null = null;

async function migrateGroups(
  migrationKey: string,
  transform: (groups: TabGroup[]) => { groups: TabGroup[]; changed: boolean }
): Promise<void> {
  const migrationFlags = await storage.getMigrationFlags();
  if (migrationFlags[migrationKey]) {
    return;
  }

  const groups = await storage.getGroups();
  const result = transform(groups);

  if (result.changed) {
    await storage.setGroups(result.groups);
  }

  await storage.setMigrationFlag(migrationKey, true);
}

async function migrateVersionFields(): Promise<void> {
  await migrateGroups('groups_v2', groups => {
    const changed = groups.some(group => group.version === undefined || group.displayOrder === undefined);

    return {
      changed,
      groups: changed ? groups.map((group, index) => initializeVersionFields(group, index)) : groups,
    };
  });
}

async function migrateFavicons(): Promise<void> {
  await migrateGroups('favicon_urls_v1', groups => {
    let changed = false;

    const nextGroups = groups.map(group => ({
      ...group,
      tabs: group.tabs.map(tab => {
        const sanitizedFavicon = sanitizeFaviconUrl(tab.favicon);

        if (sanitizedFavicon !== (tab.favicon ?? '')) {
          changed = true;
          return {
            ...tab,
            favicon: sanitizedFavicon,
          };
        }

        return tab;
      }),
    }));

    return {
      changed,
      groups: nextGroups,
    };
  });
}

async function removeLegacyRecentRestoreHistory(): Promise<void> {
  const migrationFlags = await storage.getMigrationFlags();
  const migrationKey = 'recent_restore_history_removed_v1';

  if (migrationFlags[migrationKey]) {
    return;
  }

  await kvRemove('recent_restores');
  await storage.setMigrationFlag(migrationKey, true);
}

export async function ensureLocalDataReady(): Promise<void> {
  if (!localDataReadyPromise) {
    localDataReadyPromise = (async () => {
      await initStorage();
      await migrateVersionFields();
      await migrateFavicons();
      await removeLegacyRecentRestoreHistory();
    })().catch(error => {
      localDataReadyPromise = null;
      throw error;
    });
  }

  return localDataReadyPromise;
}
