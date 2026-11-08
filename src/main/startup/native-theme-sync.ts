import type { GlobalSettings } from '../../shared/global-settings-types'

type ThemeSettingsStore = {
  getSettings: () => Pick<Partial<GlobalSettings>, 'theme'>
  onSettingsChanged: (listener: (updates: Partial<GlobalSettings>) => void) => unknown
}

/** Keeps Electron's native theme on the saved theme, whichever writer saved it (Settings, the rail, the CLI). */
export function syncNativeThemeWithSettings(
  store: ThemeSettingsStore,
  nativeTheme: { themeSource: GlobalSettings['theme'] }
): void {
  nativeTheme.themeSource = store.getSettings().theme ?? 'system'
  store.onSettingsChanged((updates) => {
    if (updates.theme) {
      nativeTheme.themeSource = updates.theme
    }
  })
}
