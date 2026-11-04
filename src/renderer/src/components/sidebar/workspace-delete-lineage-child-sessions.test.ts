import { describe, expect, it } from 'vitest'
import type { AppState } from '@/store/types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../../shared/structured-agent-session-projection'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorkspaceDeleteLineage } from './workspace-delete-lineage'
import { selectChildSessionWorktreesByWorktree } from './worktree-child-placement'

// Shape of the paired-host case: an Antigravity parent in its own worktree, two delegated children
// with worktrees of their own, linked only by the host's delegatedParent, and no worktree lineage.
const PARENT = 'antigravity_36ee0a28_393f_4fb4_8e24_2e67b3eb543d'
const CHILD_A = '2c988608-6263-4e53-8dda-7b8f21584d93'
const CHILD_B = 'e7ca0574-07fa-4372-89e4-766bb687a73e'
const READER = '367510f8-0000-4000-8000-000000000000'

function worktree(id: string): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the lineage reads id, host and instance only.
  return {
    id,
    hostId: 'runtime:vps',
    instanceId: `${id}-1`,
    isMainWorktree: false
  } as unknown as Worktree
}

function session(sessionId: string, worktreeId: string, parentSessionId?: string) {
  const tabId = structuredAgentSessionTabId(sessionId)
  const paneKey = structuredAgentSessionPaneKey(tabId, sessionId)
  const parentPaneKey = parentSessionId
    ? structuredAgentSessionPaneKey(structuredAgentSessionTabId(parentSessionId), parentSessionId)
    : undefined
  return {
    tab: { id: tabId, worktreeId, title: sessionId },
    paneKey,
    entry: {
      paneKey,
      tabId,
      worktreeId,
      state: 'done',
      prompt: '',
      updatedAt: 1,
      stateStartedAt: 1,
      stateHistory: [],
      ...(parentPaneKey
        ? {
            orchestration: {
              taskId: 'task',
              dispatchId: 'ctx',
              dispatchStatus: 'completed',
              parentPaneKey
            }
          }
        : {})
    }
  }
}

const sessions = [
  session(PARENT, 'wt-anchovy'),
  session(CHILD_A, 'wt-clinical', PARENT),
  session(CHILD_B, 'wt-pipeline', PARENT),
  // A read-only child runs in its parent's worktree.
  session(READER, 'wt-anchovy', PARENT)
]

function state(): AppState {
  const tabsByWorktree: Record<string, unknown[]> = {}
  for (const entry of sessions) {
    tabsByWorktree[entry.tab.worktreeId] = [
      ...(tabsByWorktree[entry.tab.worktreeId] ?? []),
      entry.tab
    ]
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial store; the placement reads only these maps.
  return {
    tabsByWorktree,
    unifiedTabsByWorktree: tabsByWorktree,
    runtimeAgentOrchestrationByPaneKey: {},
    retainedAgentsByPaneKey: {},
    agentStatusByPaneKey: Object.fromEntries(sessions.map((entry) => [entry.paneKey, entry.entry]))
  } as unknown as AppState
}

const worktrees = ['wt-anchovy', 'wt-clinical', 'wt-pipeline'].map(worktree)

describe('Delete with Descendants on a paired host', () => {
  it('takes the worktrees of delegated child sessions along, children first', () => {
    const lineage = getWorkspaceDeleteLineage(
      worktrees[0]!,
      worktrees,
      {},
      selectChildSessionWorktreesByWorktree(state())
    )
    expect(lineage.descendants.map((item) => item.id)).toEqual(['wt-clinical', 'wt-pipeline'])
    expect(lineage.deleteAllTargets.map((item) => item.id)).toEqual([
      'wt-clinical',
      'wt-pipeline',
      'wt-anchovy'
    ])
  })

  it("never lists the parent's own worktree for a child that runs inside it", () => {
    const children = selectChildSessionWorktreesByWorktree(state()).get('wt-anchovy') ?? []
    expect(children).not.toContain('wt-anchovy')
  })

  it('takes nothing up the tree when a child worktree is deleted', () => {
    const lineage = getWorkspaceDeleteLineage(
      worktrees[1]!,
      worktrees,
      {},
      selectChildSessionWorktreesByWorktree(state())
    )
    expect(lineage.descendants).toEqual([])
  })

  it('keeps the old result without child sessions', () => {
    expect(getWorkspaceDeleteLineage(worktrees[0]!, worktrees, {}).descendants).toEqual([])
  })
})
