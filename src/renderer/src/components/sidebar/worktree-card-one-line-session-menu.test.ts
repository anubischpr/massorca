import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { getSessionMenuKind } from './worktree-card-one-line-session-menu'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

function makeAgent(overrides: Record<string, unknown> = {}): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
  return {
    paneKey: `tab-1:${LEAF_A}`,
    tab: { id: 'tab-1', worktreeId: 'wt-1' },
    agentType: 'claude',
    state: 'idle',
    startedAt: 1,
    entry: { prompt: 'task', state: 'idle', stateStartedAt: 1, paneKey: `tab-1:${LEAF_A}` },
    ...overrides
  } as unknown as DashboardAgentRow
}

describe('getSessionMenuKind', () => {
  it('lets a live session rename, mark read and close its own tab', () => {
    expect(getSessionMenuKind(makeAgent({ rowSource: 'live' }))).toEqual({
      ownsTab: true,
      hasPane: true
    })
  })

  it('leaves out rename and close for a retained session whose tab is gone', () => {
    expect(getSessionMenuKind(makeAgent({ rowSource: 'retained' }))).toEqual({
      ownsTab: false,
      hasPane: true
    })
  })

  it('leaves out rename, close and mark read for a subagent child with no pane of its own', () => {
    expect(getSessionMenuKind(makeAgent({ rowSource: 'subagent' }))).toEqual({
      ownsTab: false,
      hasPane: false
    })
  })

  it('does not let a child rename or close the tab it shares with its parent', () => {
    const child = makeAgent({
      rowSource: 'live',
      lineage: { depth: 1, isFirstSibling: true, isLastSibling: true, childCount: 0 },
      entry: {
        prompt: 'child',
        state: 'idle',
        stateStartedAt: 1,
        paneKey: `tab-1:${LEAF_B}`,
        orchestration: { parentPaneKey: `tab-1:${LEAF_A}` }
      }
    })

    expect(getSessionMenuKind(child).ownsTab).toBe(false)
  })

  it('lets a child that runs in its own tab rename and close it', () => {
    const child = makeAgent({
      rowSource: 'live',
      lineage: { depth: 1, isFirstSibling: true, isLastSibling: true, childCount: 0 },
      entry: {
        prompt: 'child',
        state: 'idle',
        stateStartedAt: 1,
        paneKey: `tab-1:${LEAF_B}`,
        orchestration: { parentPaneKey: `tab-9:${LEAF_A}` }
      }
    })

    expect(getSessionMenuKind(child).ownsTab).toBe(true)
  })
})
