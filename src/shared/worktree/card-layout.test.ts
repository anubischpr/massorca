import { describe, expect, it } from 'vitest'
import {
  getWorktreeCardModeForLayout,
  normalizeWorktreeCardLayout,
  resolveWorktreeCardLayout,
  resolveWorktreeCardSurfaceLayout
} from './card-layout'
import { getWorktreeCardModeUpdates } from './card-properties'

describe('resolveWorktreeCardLayout', () => {
  it('defaults to one line when nothing was chosen', () => {
    expect(resolveWorktreeCardLayout({})).toBe('one-line')
    expect(resolveWorktreeCardLayout({ compactWorktreeCards: false })).toBe('one-line')
  })

  it('keeps Compact for a profile that switched it on before the layout setting existed', () => {
    expect(resolveWorktreeCardLayout({ compactWorktreeCards: true })).toBe('compact')
  })

  it('lets an explicit layout win over the legacy flag', () => {
    expect(
      resolveWorktreeCardLayout({ worktreeCardLayout: 'detailed', compactWorktreeCards: true })
    ).toBe('detailed')
    expect(
      resolveWorktreeCardLayout({ worktreeCardLayout: 'compact', compactWorktreeCards: false })
    ).toBe('compact')
  })

  it('ignores a value it does not know', () => {
    expect(normalizeWorktreeCardLayout('banner')).toBeUndefined()
    expect(normalizeWorktreeCardLayout('one-line')).toBe('one-line')
  })

  it('keeps the Detailed card until settings have loaded', () => {
    expect(resolveWorktreeCardLayout(null)).toBe('detailed')
    expect(resolveWorktreeCardLayout(undefined)).toBe('detailed')
  })
})

describe('resolveWorktreeCardSurfaceLayout', () => {
  it('gives sidebar rows the layout setting, so One line is their default', () => {
    expect(resolveWorktreeCardSurfaceLayout({}, true)).toBe('one-line')
    expect(resolveWorktreeCardSurfaceLayout({ worktreeCardLayout: 'detailed' }, true)).toBe(
      'detailed'
    )
  })

  it('keeps the folder panel and kanban card on the compact flag, never One line', () => {
    expect(resolveWorktreeCardSurfaceLayout({}, false)).toBe('detailed')
    expect(resolveWorktreeCardSurfaceLayout({ worktreeCardLayout: 'one-line' }, false)).toBe(
      'detailed'
    )
    expect(resolveWorktreeCardSurfaceLayout({ compactWorktreeCards: true }, false)).toBe('compact')
  })

  it('follows the explicit layout over a stale compact flag on the non-sidebar surfaces', () => {
    expect(
      resolveWorktreeCardSurfaceLayout(
        { compactWorktreeCards: true, worktreeCardLayout: 'detailed' },
        false
      )
    ).toBe('detailed')
    expect(
      resolveWorktreeCardSurfaceLayout(
        { compactWorktreeCards: false, worktreeCardLayout: 'compact' },
        false
      )
    ).toBe('compact')
    expect(
      resolveWorktreeCardSurfaceLayout(
        { compactWorktreeCards: true, worktreeCardLayout: 'one-line' },
        false
      )
    ).toBe('detailed')
  })

  it('lets the experimental card style win on every surface', () => {
    const settings = { experimentalNewWorktreeCardStyle: true, compactWorktreeCards: true }
    expect(resolveWorktreeCardSurfaceLayout(settings, true)).toBe('detailed')
    expect(resolveWorktreeCardSurfaceLayout(settings, false)).toBe('detailed')
  })

  it('keeps the Detailed card until settings have loaded on either surface', () => {
    expect(resolveWorktreeCardSurfaceLayout(null, true)).toBe('detailed')
    expect(resolveWorktreeCardSurfaceLayout(undefined, false)).toBe('detailed')
  })
})

describe('worktree card layout choices', () => {
  it('persists an explicit layout and keeps the legacy flag in step', () => {
    expect(getWorktreeCardModeUpdates('OneLine').settings).toEqual({
      compactWorktreeCards: false,
      worktreeCardLayout: 'one-line'
    })
    expect(getWorktreeCardModeUpdates('Default').settings).toEqual({
      compactWorktreeCards: false,
      worktreeCardLayout: 'detailed'
    })
    expect(getWorktreeCardModeUpdates('Compact').settings).toEqual({
      compactWorktreeCards: true,
      worktreeCardLayout: 'compact'
    })
  })

  it('gives One line the full property set, so the hover card keeps its details', () => {
    expect(getWorktreeCardModeUpdates('OneLine').ui.worktreeCardProperties).toEqual(
      getWorktreeCardModeUpdates('Default').ui.worktreeCardProperties
    )
  })

  it('maps menu values back to modes', () => {
    expect(getWorktreeCardModeForLayout('compact')).toBe('Compact')
    expect(getWorktreeCardModeForLayout('detailed')).toBe('Default')
    expect(getWorktreeCardModeForLayout('one-line')).toBe('OneLine')
  })
})
