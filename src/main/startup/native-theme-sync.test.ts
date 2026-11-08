import { describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { syncNativeThemeWithSettings } from './native-theme-sync'

function fakeStore(theme: GlobalSettings['theme'] | undefined) {
  const listeners: ((updates: Partial<GlobalSettings>) => void)[] = []
  return {
    getSettings: () => ({ theme }),
    onSettingsChanged: (listener: (updates: Partial<GlobalSettings>) => void) => {
      listeners.push(listener)
      return () => {}
    },
    emit: (updates: Partial<GlobalSettings>) => listeners.forEach((listener) => listener(updates))
  }
}

describe('syncNativeThemeWithSettings', () => {
  it('starts from the saved theme, system when none is saved', () => {
    const nativeTheme: { themeSource: GlobalSettings['theme'] } = { themeSource: 'light' }
    syncNativeThemeWithSettings(fakeStore(undefined), nativeTheme)
    expect(nativeTheme.themeSource).toBe('system')
  })

  it('follows a theme saved later from any writer, such as the CLI', () => {
    const store = fakeStore('system')
    const nativeTheme: { themeSource: GlobalSettings['theme'] } = { themeSource: 'system' }
    syncNativeThemeWithSettings(store, nativeTheme)
    store.emit({ theme: 'dark' })
    expect(nativeTheme.themeSource).toBe('dark')
    store.emit({ machineName: 'desk' })
    expect(nativeTheme.themeSource).toBe('dark')
  })
})
