import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { getWorstHiddenProjectGlyph } from './CollapsedProjectStatus'
import type { WorktreeGlyphInput } from '../../worktree-session-status'

// A crash-cut main agent is how a row reads as failed.
const CRASH_CUT = { state: 'done', outcome: 'interruption', stateStartedAt: 1 }

function makeAgent(paneKey: string, state: string, mainAgent?: object): DashboardAgentRow {
  const entry = { prompt: paneKey, state, stateStartedAt: 1, paneKey, updatedAt: 1, mainAgent }
  const row = { paneKey, tab: { id: 'tab-1' }, agentType: 'claude', state, startedAt: 1, entry }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
  return row as unknown as DashboardAgentRow
}

function hidden(
  status: WorktreeStatus | undefined,
  overrides: Partial<WorktreeGlyphInput> = {}
): WorktreeGlyphInput {
  return { agents: [], acknowledgedAgentTimes: [], status, isUnread: false, ...overrides }
}

describe('getWorstHiddenProjectGlyph', () => {
  it('shows the most urgent status among the hidden worktrees', () => {
    const glyph = getWorstHiddenProjectGlyph([
      hidden('working'),
      hidden('permission'),
      hidden('failed')
    ])

    expect(glyph).toBe('needs-human')
  })

  it('puts failure ahead of live work', () => {
    expect(getWorstHiddenProjectGlyph([hidden('working'), hidden('failed')])).toBe('failed')
  })

  it('shows unread only when nothing louder is hidden', () => {
    expect(
      getWorstHiddenProjectGlyph([hidden('done', { isUnread: true }), hidden('inactive')])
    ).toBe('unread')
    expect(getWorstHiddenProjectGlyph([hidden('done'), hidden('inactive')])).toBeNull()
  })

  it('shows nothing for a project whose worktrees are all quiet and seen', () => {
    expect(getWorstHiddenProjectGlyph([hidden('active')])).toBeNull()
  })

  it('ignores worktrees whose status is not known yet', () => {
    expect(getWorstHiddenProjectGlyph([hidden(undefined)])).toBeNull()
  })

  it('lets a retained failure in a hidden worktree outrank its live work', () => {
    const agents = [makeAgent('live', 'working'), makeAgent('retained', 'done', CRASH_CUT)]

    expect(
      getWorstHiddenProjectGlyph([hidden('working', { agents, acknowledgedAgentTimes: [0, 0] })])
    ).toBe('failed')
  })

  it('keeps a hidden worktree unread after activation while a session stays unopened', () => {
    const agents = [makeAgent('done', 'done')]

    expect(
      getWorstHiddenProjectGlyph([
        hidden('done', { agents, acknowledgedAgentTimes: [0], isUnread: false })
      ])
    ).toBe('unread')
  })
})
