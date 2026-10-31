import { describe, expect, it } from 'vitest'
import {
  isSessionGlyphUrgent,
  selectVisibleSessions,
  sessionStatusGlyph,
  VISIBLE_SESSION_LIMIT,
  worktreeStatusGlyph,
  worstSessionStatusGlyph
} from './worktree-session-status'

describe('sessionStatusGlyph', () => {
  it('shows one needs-human glyph for waiting, blocked and permission', () => {
    expect(sessionStatusGlyph('waiting', false)).toBe('needs-human')
    expect(sessionStatusGlyph('blocked', false)).toBe('needs-human')
    expect(sessionStatusGlyph('permission', false)).toBe('needs-human')
  })

  it('keeps red for failures and shows lost contact as unconfirmed', () => {
    expect(sessionStatusGlyph('failed', false)).toBe('failed')
    expect(sessionStatusGlyph('unverifiable', false)).toBe('unconfirmed')
    expect(sessionStatusGlyph('unconfirmed', true)).toBe('unconfirmed')
  })

  it('shows nothing for a finished session that was already seen', () => {
    expect(sessionStatusGlyph('done', false)).toBeNull()
    expect(sessionStatusGlyph('idle', false)).toBeNull()
    expect(sessionStatusGlyph('interrupted', false)).toBeNull()
  })

  it('marks a finished session nobody has opened as unread', () => {
    expect(sessionStatusGlyph('done', true)).toBe('unread')
  })
})

describe('worstSessionStatusGlyph', () => {
  it('ranks a pending question over failure, failure over work, work over unread', () => {
    expect(worstSessionStatusGlyph(['working', 'failed', 'needs-human'])).toBe('needs-human')
    expect(worstSessionStatusGlyph(['unread', 'working', 'failed'])).toBe('failed')
    expect(worstSessionStatusGlyph([null, 'unread', 'working'])).toBe('working')
    expect(worstSessionStatusGlyph(['unconfirmed', 'unread'])).toBe('unconfirmed')
  })

  it('is empty when nothing is worth showing', () => {
    expect(worstSessionStatusGlyph([null, null])).toBeNull()
    expect(worstSessionStatusGlyph([])).toBeNull()
  })

  it('speaks for a collapsed branch from its hidden sessions', () => {
    const hidden = [
      sessionStatusGlyph('done', true),
      sessionStatusGlyph('working', false),
      sessionStatusGlyph('blocked', false)
    ]
    expect(worstSessionStatusGlyph(hidden)).toBe('needs-human')
  })
})

describe('worktreeStatusGlyph', () => {
  it('maps the worktree-level status and shows unread only when nothing louder applies', () => {
    expect(worktreeStatusGlyph('permission', true)).toBe('needs-human')
    expect(worktreeStatusGlyph('failed', false)).toBe('failed')
    expect(worktreeStatusGlyph('done', true)).toBe('unread')
    expect(worktreeStatusGlyph('done', false)).toBeNull()
    expect(worktreeStatusGlyph('inactive', false)).toBeNull()
  })
})

describe('selectVisibleSessions', () => {
  type Row = { id: string; urgent: boolean }
  const rows = (urgentIds: string[], total: number): Row[] =>
    Array.from({ length: total }, (_, index) => ({
      id: `s${index + 1}`,
      urgent: urgentIds.includes(`s${index + 1}`)
    }))

  it('shows everything up to the limit', () => {
    const result = selectVisibleSessions(rows([], VISIBLE_SESSION_LIMIT), (row) => row.urgent)
    expect(result.hiddenCount).toBe(0)
    expect(result.visible).toHaveLength(VISIBLE_SESSION_LIMIT)
  })

  it('folds the rest behind a count once past five', () => {
    const result = selectVisibleSessions(rows([], 8), (row) => row.urgent)
    expect(result.visible.map((row) => row.id)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(result.hiddenCount).toBe(3)
  })

  it('never hides an urgent session, even one that sorts past the limit', () => {
    const result = selectVisibleSessions(rows(['s7'], 8), (row) => row.urgent)
    expect(result.visible.map((row) => row.id)).toEqual(['s1', 's2', 's3', 's4', 's7'])
    expect(result.hiddenCount).toBe(3)
  })

  it('shows every urgent session even when they outnumber the limit', () => {
    const urgent = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
    const result = selectVisibleSessions(rows(urgent, 9), (row) => row.urgent)
    expect(result.visible.map((row) => row.id)).toEqual(urgent)
    expect(result.hiddenCount).toBe(2)
  })

  it('treats lost contact as ordinary, not urgent', () => {
    expect(isSessionGlyphUrgent('unconfirmed')).toBe(false)
    expect(isSessionGlyphUrgent(null)).toBe(false)
    expect(isSessionGlyphUrgent('unread')).toBe(true)
    expect(isSessionGlyphUrgent('needs-human')).toBe(true)
  })
})
