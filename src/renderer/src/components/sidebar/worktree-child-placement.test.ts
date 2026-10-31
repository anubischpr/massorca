import { describe, expect, it } from 'vitest'
import { applyAgentRowLineage } from '@/components/dashboard/agent-row-lineage'
import type { RetainedAgentEntry } from '@/store/slices/agent-status'
import type { AppState } from '@/store/types'
import type {
  AgentStatusEntry,
  AgentStatusOrchestrationContext
} from '../../../../shared/agent-status-types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import { resolveBranchRowPlacement } from './worktree-branch-row-placement'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  selectBranchRowCandidatesByWorktree,
  selectCrossWorktreeChildTabs,
  selectCrossWorktreeLiveChildEntries,
  selectCrossWorktreeRetainedChildren,
  selectPlacedAwayPaneKeysForWorktree
} from './worktree-child-placement'

const LEAF_A = '22222222-2222-4222-8222-222222222222'
const LEAF_B = '33333333-3333-4333-8333-333333333333'
const LEAF_C = '55555555-5555-4555-8555-555555555555'
const PARENT = makePaneKey('tab-a', LEAF_A)
const CHILD = makePaneKey('tab-b', LEAF_B)
const GRANDCHILD = makePaneKey('tab-c', LEAF_C)

function makeTab(id: string, worktreeId: string): TerminalTab {
  return {
    id,
    worktreeId,
    ptyId: null,
    title: 'Claude',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function makeEntry(paneKey: string, overrides?: Partial<AgentStatusEntry>): AgentStatusEntry {
  return {
    paneKey,
    state: 'working',
    stateStartedAt: 1000,
    updatedAt: 1000,
    stateHistory: [],
    prompt: 'work',
    agentType: 'claude',
    terminalTitle: undefined,
    interrupted: false,
    ...overrides
  }
}

function parentOf(parentPaneKey: string): AgentStatusEntry['orchestration'] {
  return { taskId: 'task', dispatchId: 'dispatch', parentPaneKey }
}

function makeRetained(
  paneKey: string,
  worktreeId: string,
  tab: TerminalTab,
  overrides?: Partial<AgentStatusEntry>
): RetainedAgentEntry {
  return {
    entry: makeEntry(paneKey, { state: 'done', ...overrides }),
    worktreeId,
    tab,
    agentType: 'claude',
    startedAt: 1000
  }
}

type Parts = {
  agents?: Record<string, AgentStatusEntry>
  retained?: Record<string, RetainedAgentEntry>
  tabs?: Record<string, TerminalTab[]>
  orchestration?: Record<string, AgentStatusOrchestrationContext>
}

function stateWith(parts: Parts): AppState {
  const partial = {
    agentStatusByPaneKey: parts.agents ?? {},
    retainedAgentsByPaneKey: parts.retained ?? {},
    runtimeAgentOrchestrationByPaneKey: parts.orchestration ?? {},
    tabsByWorktree: parts.tabs ?? {},
    unifiedTabsByWorktree: {},
    ptyIdsByTabId: {},
    terminalLayoutsByTabId: {}
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial store fixture; the placement selectors read only these maps.
  return partial as unknown as AppState
}

// A parent in worktree A and its child running in worktree B, linked by the child's own entry.
function parentAndChild(childEntryOverrides?: Partial<AgentStatusEntry>): Parts {
  return {
    agents: {
      [PARENT]: makeEntry(PARENT),
      [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT), ...childEntryOverrides })
    },
    tabs: {
      'wt-a': [makeTab('tab-a', 'wt-a')],
      'wt-b': [makeTab('tab-b', 'wt-b')]
    }
  }
}

describe('cross-worktree child placement', () => {
  it('moves a child session out of its own worktree and under its parent in the parent worktree', () => {
    const state = stateWith(parentAndChild())

    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([CHILD])
    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-a')).toEqual([])
    expect(selectCrossWorktreeLiveChildEntries(state, 'wt-a').map((e) => e.paneKey)).toEqual([
      CHILD
    ])
    expect(selectCrossWorktreeChildTabs(state, 'wt-a').map((tab) => tab.worktreeId)).toEqual([
      'wt-b'
    ])
  })

  it('keeps a child in its own worktree when its parent is gone', () => {
    const state = stateWith({
      agents: { [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) }) },
      tabs: { 'wt-b': [makeTab('tab-b', 'wt-b')] }
    })

    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([])
    expect(selectCrossWorktreeLiveChildEntries(state, 'wt-a')).toEqual([])
  })

  it('places a grandchild under the child, so the whole chain lists under the outer parent', () => {
    const state = stateWith({
      agents: {
        [PARENT]: makeEntry(PARENT),
        [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) }),
        [GRANDCHILD]: makeEntry(GRANDCHILD, { orchestration: parentOf(CHILD) })
      },
      tabs: {
        'wt-a': [makeTab('tab-a', 'wt-a')],
        'wt-b': [makeTab('tab-b', 'wt-b')],
        'wt-c': [makeTab('tab-c', 'wt-c')]
      }
    })

    expect(
      selectCrossWorktreeLiveChildEntries(state, 'wt-a')
        .map((e) => e.paneKey)
        .sort()
    ).toEqual([CHILD, GRANDCHILD].sort())
    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([CHILD])
    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-c')).toEqual([GRANDCHILD])
  })

  it('reads the parent link from the runtime orchestration context when the entry has none', () => {
    const state = stateWith({
      agents: { [PARENT]: makeEntry(PARENT), [CHILD]: makeEntry(CHILD) },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')], 'wt-b': [makeTab('tab-b', 'wt-b')] },
      orchestration: { [CHILD]: { taskId: 'task', dispatchId: 'dispatch', parentPaneKey: PARENT } }
    })

    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([CHILD])
  })

  it('places a child under a retained parent and lists the retained child there', () => {
    const tabA = makeTab('tab-a', 'wt-a')
    const state = stateWith({
      agents: { [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) }) },
      retained: { [PARENT]: makeRetained(PARENT, 'wt-a', tabA) },
      tabs: { 'wt-b': [makeTab('tab-b', 'wt-b')] }
    })

    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([CHILD])
    expect(selectCrossWorktreeLiveChildEntries(state, 'wt-a').map((e) => e.paneKey)).toEqual([
      CHILD
    ])
  })

  it('lists a retained child of another worktree under its parent', () => {
    const tabB = makeTab('tab-b', 'wt-b')
    const state = stateWith({
      agents: { [PARENT]: makeEntry(PARENT) },
      retained: { [CHILD]: makeRetained(CHILD, 'wt-b', tabB, { orchestration: parentOf(PARENT) }) },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')] }
    })

    expect(selectPlacedAwayPaneKeysForWorktree(state, 'wt-b')).toEqual([CHILD])
    expect(selectCrossWorktreeRetainedChildren(state, 'wt-a').map((r) => r.entry.paneKey)).toEqual([
      CHILD
    ])
  })

  it('does not list a session twice when two sessions name each other as parent', () => {
    const state = stateWith({
      agents: {
        [PARENT]: makeEntry(PARENT, { orchestration: parentOf(CHILD) }),
        [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) })
      },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')], 'wt-b': [makeTab('tab-b', 'wt-b')] }
    })

    const listedInA = buildWorktreeAgentRows({
      tabs: [makeTab('tab-a', 'wt-a')],
      entries: [makeEntry(PARENT, { orchestration: parentOf(CHILD) })],
      retained: [],
      placedElsewherePaneKeys: selectPlacedAwayPaneKeysForWorktree(state, 'wt-a'),
      crossWorktreeChildren: {
        entries: selectCrossWorktreeLiveChildEntries(state, 'wt-a'),
        retained: selectCrossWorktreeRetainedChildren(state, 'wt-a'),
        tabs: selectCrossWorktreeChildTabs(state, 'wt-a'),
        ptyIdsByTabId: {},
        terminalLayoutsByTabId: {}
      },
      now: 2000
    })
    const listedInB = buildWorktreeAgentRows({
      tabs: [makeTab('tab-b', 'wt-b')],
      entries: [makeEntry(CHILD, { orchestration: parentOf(PARENT) })],
      retained: [],
      placedElsewherePaneKeys: selectPlacedAwayPaneKeysForWorktree(state, 'wt-b'),
      now: 2000
    })
    const shown = [...listedInA, ...listedInB].map((row) => row.paneKey)
    expect(shown.filter((paneKey) => paneKey === PARENT)).toHaveLength(1)
    expect(shown.filter((paneKey) => paneKey === CHILD)).toHaveLength(1)
  })
})

describe('worktree agent rows across worktrees', () => {
  const childEntry = makeEntry(CHILD, { orchestration: parentOf(PARENT) })
  const state = stateWith(parentAndChild())

  it('lists the child once under its parent with a cross-worktree mark', () => {
    const rowsInA = buildWorktreeAgentRows({
      tabs: [makeTab('tab-a', 'wt-a')],
      entries: [makeEntry(PARENT)],
      retained: [],
      placedElsewherePaneKeys: selectPlacedAwayPaneKeysForWorktree(state, 'wt-a'),
      crossWorktreeChildren: {
        entries: selectCrossWorktreeLiveChildEntries(state, 'wt-a'),
        retained: [],
        tabs: selectCrossWorktreeChildTabs(state, 'wt-a'),
        ptyIdsByTabId: {},
        terminalLayoutsByTabId: {}
      },
      now: 2000
    })
    const lineaged = applyAgentRowLineage(rowsInA)
    const child = lineaged.find((row) => row.paneKey === CHILD)

    expect(lineaged.map((row) => row.paneKey).filter((key) => key === CHILD)).toHaveLength(1)
    expect(child?.crossWorktree).toBe(true)
    expect(child?.tab.worktreeId).toBe('wt-b')
    expect(child?.lineage.parentPaneKey).toBe(PARENT)
    expect(lineaged.find((row) => row.paneKey === PARENT)?.crossWorktree).toBeUndefined()
  })

  it('does not list the child in its own worktree once it is placed under its parent', () => {
    const rowsInB = buildWorktreeAgentRows({
      tabs: [makeTab('tab-b', 'wt-b')],
      entries: [childEntry],
      retained: [],
      placedElsewherePaneKeys: selectPlacedAwayPaneKeysForWorktree(state, 'wt-b'),
      now: 2000
    })

    expect(rowsInB.map((row) => row.paneKey)).toEqual([])
  })

  it('lists the child as a root row in its own worktree when nothing places it', () => {
    const rowsInB = buildWorktreeAgentRows({
      tabs: [makeTab('tab-b', 'wt-b')],
      entries: [childEntry],
      retained: [],
      now: 2000
    })

    expect(rowsInB.map((row) => row.paneKey)).toEqual([CHILD])
    expect(rowsInB[0].crossWorktree).toBeUndefined()
  })
})

describe('branch row placement for cross-worktree children', () => {
  function worktreeStub(id: string): Worktree {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the placement resolver reads only the worktree id.
    return { id } as unknown as Worktree
  }

  function resolveFor(state: AppState, worktreeIds: string[]) {
    return resolveBranchRowPlacement({
      candidatesByWorktree: selectBranchRowCandidatesByWorktree(state),
      worktrees: worktreeIds.map(worktreeStub)
    })
  }

  const ALL = ['wt-a', 'wt-b', 'wt-c']

  it('hides the child worktree row when its only session runs under a parent in another worktree', () => {
    const state = stateWith(parentAndChild())
    const placement = resolveFor(state, ['wt-a', 'wt-b'])

    expect([...placement.hiddenWorktreeIds]).toEqual(['wt-b'])
  })

  it('keeps the child worktree row when it also lists a session of its own', () => {
    const own = makeEntry(makePaneKey('tab-b2', LEAF_C), {})
    const state = stateWith({
      ...parentAndChild(),
      agents: {
        ...parentAndChild().agents,
        [makePaneKey('tab-b2', LEAF_C)]: own
      },
      tabs: {
        'wt-a': [makeTab('tab-a', 'wt-a')],
        'wt-b': [makeTab('tab-b', 'wt-b'), makeTab('tab-b2', 'wt-b')]
      }
    })
    const placement = resolveFor(state, ['wt-a', 'wt-b'])

    expect(placement.hiddenWorktreeIds.has('wt-b')).toBe(false)
  })

  it('shows the child row again once its session is gone', () => {
    const state = stateWith({
      agents: { [PARENT]: makeEntry(PARENT) },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')], 'wt-b': [] }
    })
    const placement = resolveFor(state, ALL.slice(0, 2))

    expect(placement.hiddenWorktreeIds.size).toBe(0)
  })

  it('keeps the child row when its parent session is gone and nothing places it', () => {
    const state = stateWith({
      agents: { [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) }) },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')], 'wt-b': [makeTab('tab-b', 'wt-b')] }
    })
    const placement = resolveFor(state, ALL.slice(0, 2))

    expect(placement.hiddenWorktreeIds.size).toBe(0)
  })

  it('keeps the child row when its parent worktree is filtered out of the list', () => {
    const state = stateWith(parentAndChild())
    const placement = resolveFor(state, ['wt-b'])

    expect(placement.hiddenWorktreeIds.size).toBe(0)
  })

  it('hides the middle of a nested chain and keeps the top-level parent row', () => {
    const state = stateWith({
      agents: {
        [PARENT]: makeEntry(PARENT),
        [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) }),
        [GRANDCHILD]: makeEntry(GRANDCHILD, { orchestration: parentOf(CHILD) })
      },
      tabs: {
        'wt-a': [makeTab('tab-a', 'wt-a')],
        'wt-b': [makeTab('tab-b', 'wt-b')],
        'wt-c': [makeTab('tab-c', 'wt-c')]
      }
    })
    const placement = resolveFor(state, ALL)

    expect([...placement.hiddenWorktreeIds].sort()).toEqual(['wt-b', 'wt-c'])
    expect(placement.hiddenWorktreeIds.has('wt-a')).toBe(false)
  })

  it('keeps the rows of a session cycle so the cycle never hides every row', () => {
    const state = stateWith({
      agents: {
        [PARENT]: makeEntry(PARENT, { orchestration: parentOf(CHILD) }),
        [CHILD]: makeEntry(CHILD, { orchestration: parentOf(PARENT) })
      },
      tabs: { 'wt-a': [makeTab('tab-a', 'wt-a')], 'wt-b': [makeTab('tab-b', 'wt-b')] }
    })
    const placement = resolveFor(state, ALL.slice(0, 2))

    expect(placement.hiddenWorktreeIds.size).toBe(0)
  })
})
