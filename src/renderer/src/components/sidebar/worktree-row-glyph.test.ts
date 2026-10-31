import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { worktreeRowGlyph } from './worktree-session-status'

// A crash-cut main agent is how a row reads as failed.
const CRASH_CUT = { state: 'done', outcome: 'interruption', stateStartedAt: 1 }

function makeAgent(paneKey: string, state: string, mainAgent?: object): DashboardAgentRow {
  const entry = { prompt: paneKey, state, stateStartedAt: 1, paneKey, updatedAt: 1, mainAgent }
  const row = { paneKey, tab: { id: 'tab-1' }, agentType: 'claude', state, startedAt: 1, entry }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
  return row as unknown as DashboardAgentRow
}

describe('worktreeRowGlyph', () => {
  it('lets a retained failure beat live work in the same worktree', () => {
    const agents = [makeAgent('live', 'working'), makeAgent('retained', 'done', CRASH_CUT)]

    expect(
      worktreeRowGlyph({
        agents,
        acknowledgedAgentTimes: [0, 0],
        status: 'working',
        isUnread: false
      })
    ).toBe('failed')
  })

  it('keeps an unseen session unread after the worktree was activated', () => {
    expect(
      worktreeRowGlyph({
        agents: [makeAgent('done', 'done')],
        acknowledgedAgentTimes: [0],
        status: 'done',
        isUnread: false
      })
    ).toBe('unread')
  })

  it('shows nothing for seen sessions even when the worktree status still says working', () => {
    expect(
      worktreeRowGlyph({
        agents: [makeAgent('done', 'done')],
        acknowledgedAgentTimes: [1],
        status: 'working',
        isUnread: false
      })
    ).toBeNull()
  })

  it('keeps the worktree unread mark on a folded branch when every session is seen', () => {
    // Why: a background terminal bell marks the worktree unread with no unseen session row to show it.
    expect(
      worktreeRowGlyph({
        agents: [makeAgent('done', 'done')],
        acknowledgedAgentTimes: [1],
        status: 'done',
        isUnread: true
      })
    ).toBe('unread')
  })

  it('lets a session that is working outrank the worktree unread mark', () => {
    expect(
      worktreeRowGlyph({
        agents: [makeAgent('live', 'working')],
        acknowledgedAgentTimes: [0],
        status: 'working',
        isUnread: true
      })
    ).toBe('working')
  })

  it('uses the worktree status only when the worktree has no session rows', () => {
    expect(
      worktreeRowGlyph({ agents: [], acknowledgedAgentTimes: [], status: 'failed', isUnread: false })
    ).toBe('failed')
    expect(
      worktreeRowGlyph({ agents: [], acknowledgedAgentTimes: [], status: 'done', isUnread: true })
    ).toBe('unread')
    expect(
      worktreeRowGlyph({ agents: [], acknowledgedAgentTimes: [], status: undefined, isUnread: true })
    ).toBeNull()
  })
})
