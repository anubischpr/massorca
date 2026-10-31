import { describe, expect, it } from 'vitest'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { getWorstHiddenProjectGlyph } from './CollapsedProjectStatus'

const statuses = (entries: [string, WorktreeStatus][]): Map<string, WorktreeStatus> =>
  new Map(entries)

describe('getWorstHiddenProjectGlyph', () => {
  it('shows the most urgent status among the hidden worktrees', () => {
    const glyph = getWorstHiddenProjectGlyph(
      ['a', 'b', 'c'],
      statuses([
        ['a', 'working'],
        ['b', 'permission'],
        ['c', 'failed']
      ]),
      new Set()
    )

    expect(glyph).toBe('needs-human')
  })

  it('puts failure ahead of live work', () => {
    const glyph = getWorstHiddenProjectGlyph(
      ['a', 'b'],
      statuses([
        ['a', 'working'],
        ['b', 'failed']
      ]),
      new Set()
    )

    expect(glyph).toBe('failed')
  })

  it('shows unread only when nothing louder is hidden', () => {
    const quiet = statuses([
      ['a', 'done'],
      ['b', 'inactive']
    ])

    expect(getWorstHiddenProjectGlyph(['a', 'b'], quiet, new Set(['a']))).toBe('unread')
    expect(getWorstHiddenProjectGlyph(['a', 'b'], quiet, new Set())).toBeNull()
  })

  it('shows nothing for a project whose worktrees are all quiet and seen', () => {
    expect(getWorstHiddenProjectGlyph(['a'], statuses([['a', 'active']]), new Set())).toBeNull()
  })

  it('ignores worktrees whose status is not known yet', () => {
    expect(getWorstHiddenProjectGlyph(['missing'], statuses([]), new Set())).toBeNull()
  })
})
