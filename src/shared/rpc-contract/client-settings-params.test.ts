import { describe, expect, it } from 'vitest'
import { SettingsUpdate } from './client-settings-params'

describe('settings.update schema', () => {
  it('accepts the card layout beside the legacy compact flag in one update', () => {
    expect(
      SettingsUpdate.parse({ compactWorktreeCards: true, worktreeCardLayout: 'compact' })
    ).toEqual({ compactWorktreeCards: true, worktreeCardLayout: 'compact' })
  })

  it('accepts each card layout a client can choose', () => {
    for (const worktreeCardLayout of ['one-line', 'detailed', 'compact'] as const) {
      expect(SettingsUpdate.parse({ worktreeCardLayout })).toEqual({ worktreeCardLayout })
    }
  })

  it('rejects a card layout it does not know', () => {
    expect(() => SettingsUpdate.parse({ worktreeCardLayout: 'banner' })).toThrow()
  })
})
