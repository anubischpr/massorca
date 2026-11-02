import { describe, expect, it, vi } from 'vitest'
import { createGlobalSettingsFixture } from '../../shared/global-settings-test-fixture'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { RuntimeClientSettingsController } from './runtime-client-settings'

function makeController(settings: GlobalSettings) {
  const updateSettings = vi.fn((updates: Partial<GlobalSettings>) =>
    Object.assign(settings, updates)
  )
  const controller = new RuntimeClientSettingsController({
    getSettings: () => settings,
    updateSettings
  })
  return { controller, updateSettings }
}

describe('RuntimeClientSettingsController card layout', () => {
  it('stores Compact when an older client switches only the compact flag on', async () => {
    const settings = createGlobalSettingsFixture({
      workspaceDir: '/w',
      worktreeCardLayout: 'one-line'
    })
    const { controller, updateSettings } = makeController(settings)

    await controller.update({ compactWorktreeCards: true })

    expect(updateSettings).toHaveBeenCalledWith(
      { compactWorktreeCards: true, worktreeCardLayout: 'compact' },
      { notifyListeners: true }
    )
    expect(controller.get().worktreeCardLayout).toBe('compact')
  })

  it('stores Detailed when an older client switches the compact flag off', async () => {
    const settings = createGlobalSettingsFixture({
      workspaceDir: '/w',
      worktreeCardLayout: 'compact',
      compactWorktreeCards: true
    })
    const { controller } = makeController(settings)

    await controller.update({ compactWorktreeCards: false })

    expect(controller.get().worktreeCardLayout).toBe('detailed')
  })

  it('keeps an explicit layout that arrives with the legacy flag', async () => {
    const settings = createGlobalSettingsFixture({ workspaceDir: '/w' })
    const { controller, updateSettings } = makeController(settings)

    await controller.update({ compactWorktreeCards: true, worktreeCardLayout: 'one-line' })

    expect(updateSettings).toHaveBeenCalledWith(
      { compactWorktreeCards: true, worktreeCardLayout: 'one-line' },
      { notifyListeners: true }
    )
    expect(controller.get().worktreeCardLayout).toBe('one-line')
  })

  it('leaves a stored layout alone when the update does not mention the layout', async () => {
    const settings = createGlobalSettingsFixture({
      workspaceDir: '/w',
      worktreeCardLayout: 'detailed'
    })
    const { controller, updateSettings } = makeController(settings)

    await controller.update({ minimaxGroupId: 'group-7' })

    expect(updateSettings).toHaveBeenCalledWith(
      { minimaxGroupId: 'group-7' },
      { notifyListeners: true }
    )
    expect(controller.get().worktreeCardLayout).toBe('detailed')
  })
})
