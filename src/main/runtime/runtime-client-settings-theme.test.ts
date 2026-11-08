import { describe, expect, it, vi } from 'vitest'
import { RuntimeClientSettingsController } from './runtime-client-settings'
import { createGlobalSettingsFixture } from '../../shared/global-settings-test-fixture'
import type { GlobalSettings } from '../../shared/global-settings-types'

function controllerWith(theme: GlobalSettings['theme']) {
  let settings: GlobalSettings = { ...createGlobalSettingsFixture({ workspaceDir: '/w' }), theme }
  const updateSettings = vi.fn((updates: Partial<GlobalSettings>) => {
    settings = { ...settings, ...updates }
    return settings
  })
  const controller = new RuntimeClientSettingsController({
    getSettings: () => settings,
    updateSettings
  })
  return { controller, updateSettings }
}

describe('RuntimeClientSettingsController theme', () => {
  it('reads the saved theme', () => {
    expect(controllerWith('dark').controller.getTheme()).toBe('dark')
  })

  it('saves a theme and tells the app windows, which apply it', () => {
    const { controller, updateSettings } = controllerWith('system')
    expect(controller.setTheme('light')).toBe('light')
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'light' }, { notifyListeners: true })
    expect(controller.getTheme()).toBe('light')
  })
})
