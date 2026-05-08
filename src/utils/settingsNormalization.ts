import type { LayoutMode, ThemeStyle, UserSettings } from '../types/tab';

export const VALID_THEME_STYLES: ThemeStyle[] = [
  'legacy',
  'classic',
  'aurora',
  'creamy',
  'pink',
  'mint',
  'cyberpunk',
  'prism',
];

export const VALID_THEME_MODES: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];

type LegacySettings = Partial<UserSettings> & {
  useDoubleColumnLayout?: boolean;
};

export function validateThemeStyle(value: unknown): ThemeStyle {
  if (typeof value === 'string' && VALID_THEME_STYLES.includes(value as ThemeStyle)) {
    return value as ThemeStyle;
  }

  return 'legacy';
}

export function validateThemeMode(value: unknown): 'light' | 'dark' | 'auto' {
  if (typeof value === 'string' && VALID_THEME_MODES.includes(value as 'light' | 'dark' | 'auto')) {
    return value as 'light' | 'dark' | 'auto';
  }

  return 'auto';
}

function toLegacySettings(rawSettings: unknown): LegacySettings {
  return rawSettings && typeof rawSettings === 'object' ? (rawSettings as LegacySettings) : {};
}

export function normalizeStoredSettings(
  rawSettings: unknown,
  defaultSettings: UserSettings
): { settings: UserSettings; needsRewrite: boolean } {
  const normalizedSettings = { ...toLegacySettings(rawSettings) };

  let needsRewrite = false;

  if (
    'useDoubleColumnLayout' in normalizedSettings &&
    normalizedSettings.useDoubleColumnLayout !== undefined &&
    normalizedSettings.layoutMode === undefined
  ) {
    normalizedSettings.layoutMode = normalizedSettings.useDoubleColumnLayout ? 'double' : 'single';
    delete normalizedSettings.useDoubleColumnLayout;
    needsRewrite = true;
  }

  const validatedThemeStyle = validateThemeStyle(normalizedSettings.themeStyle);
  const validatedThemeMode = validateThemeMode(normalizedSettings.themeMode);

  if (
    normalizedSettings.themeStyle !== undefined &&
    normalizedSettings.themeStyle !== validatedThemeStyle
  ) {
    needsRewrite = true;
  }

  if (
    normalizedSettings.themeMode !== undefined &&
    normalizedSettings.themeMode !== validatedThemeMode
  ) {
    needsRewrite = true;
  }

  return {
    settings: {
      ...defaultSettings,
      ...normalizedSettings,
      layoutMode: (normalizedSettings.layoutMode as LayoutMode | undefined) ?? defaultSettings.layoutMode,
      themeStyle: validatedThemeStyle,
      themeMode: validatedThemeMode,
    },
    needsRewrite,
  };
}
