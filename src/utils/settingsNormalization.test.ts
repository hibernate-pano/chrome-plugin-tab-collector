import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStoredSettings, validateThemeMode, validateThemeStyle } from './settingsNormalization.ts';
import type { UserSettings } from '../types/tab';

const DEFAULT_SETTINGS: UserSettings = {
  groupNameTemplate: 'Group %d',
  showFavicons: true,
  showTabCount: true,
  confirmBeforeDelete: true,
  allowDuplicateTabs: false,
  layoutMode: 'single',
  showNotifications: false,
  themeMode: 'auto',
  themeStyle: 'legacy',
  collectPinnedTabs: false,
};

test('normalizeStoredSettings migrates legacy double-column flag and invalid theme values', () => {
  const result = normalizeStoredSettings(
    {
      useDoubleColumnLayout: true,
      themeStyle: 'broken-theme',
      themeMode: 'broken-mode',
      showNotifications: true,
    },
    DEFAULT_SETTINGS
  );

  assert.equal(result.needsRewrite, true);
  assert.equal(result.settings.layoutMode, 'double');
  assert.equal(result.settings.themeStyle, 'legacy');
  assert.equal(result.settings.themeMode, 'auto');
  assert.equal(result.settings.showNotifications, true);
});

test('normalizeStoredSettings keeps valid modern settings unchanged', () => {
  const result = normalizeStoredSettings(
    {
      layoutMode: 'double',
      themeStyle: 'mint',
      themeMode: 'dark',
    },
    DEFAULT_SETTINGS
  );

  assert.equal(result.needsRewrite, false);
  assert.equal(result.settings.layoutMode, 'double');
  assert.equal(result.settings.themeStyle, 'mint');
  assert.equal(result.settings.themeMode, 'dark');
});

test('theme validators fall back to local defaults', () => {
  assert.equal(validateThemeStyle('aurora'), 'aurora');
  assert.equal(validateThemeStyle('not-real'), 'legacy');
  assert.equal(validateThemeMode('light'), 'light');
  assert.equal(validateThemeMode('not-real'), 'auto');
});
