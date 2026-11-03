import { describe, expect, it } from 'vitest'
import type { WorkspaceSessionState } from '../../../../../shared/workspace-session-state-types'
import { workspaceSessionStateSchema } from '../../../../../shared/workspace-session-schema'
import { buildWorkspaceSessionPayload } from '../../../lib/workspace-session'
import { createTestStore, makeTabGroup, makeUnifiedTab, makeWorktree } from '../store-test-helpers'
import { selectLayoutWorktreeId } from './pane-session-ref'

const A = 'repo1::/work/a'
const B = 'repo1::/work/b'

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

function seededStore() {
  const store = createTestStore()
  store.setState({
    worktreesByRepo: {
      repo1: [makeWorktree({ id: A, repoId: 'repo1' }), makeWorktree({ id: B, repoId: 'repo1' })]
    },
    activeRepoId: 'repo1',
    activeWorktreeId: A,
    unifiedTabsByWorktree: {
      [A]: [chat('a-chat', A, 'a-main')],
      [B]: [chat('b-chat', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({ id: 'a-main', worktreeId: A, tabOrder: ['a-chat'], activeTabId: 'a-chat' }),
        {
          ...makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null }),
          sessionRef: { worktreeId: B, tabId: 'b-chat' }
        }
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    activeGroupIdByWorktree: { [A]: 'a-main', [B]: 'b-main' },
    layoutByWorktree: {
      [A]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'a-main' },
        second: { type: 'leaf', groupId: 'a-pane' }
      },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  })
  return store
}

/** What a relaunch reads back: the saved payload, through the same validation startup runs. */
function saveAndRead(store: ReturnType<typeof createTestStore>): WorkspaceSessionState {
  const parsed = workspaceSessionStateSchema.safeParse(
    JSON.parse(JSON.stringify(buildWorkspaceSessionPayload(store.getState())))
  )
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  return parsed.data
}

function relaunch(session: WorkspaceSessionState) {
  const next = createTestStore()
  next.setState({
    worktreesByRepo: {
      repo1: [makeWorktree({ id: A, repoId: 'repo1' }), makeWorktree({ id: B, repoId: 'repo1' })]
    },
    // Why: hydrateWorkspaceSession restores the active workspace before the tab model.
    activeWorktreeId: session.activeWorktreeId ?? null
  })
  next.getState().hydrateTabsSession(session)
  return next.getState()
}

describe('a pane showing another workspace’s session, focused at quit', () => {
  it('has the focus again after a relaunch, in the layout that was on screen', () => {
    const store = seededStore()
    store.getState().focusGroup(A, 'a-pane')
    const state = relaunch(saveAndRead(store))
    expect(state.activeWorktreeId).toBe(B)
    expect(state.paneFocus).toEqual({ layoutWorktreeId: A, ownerWorktreeId: B, groupId: 'a-pane' })
    expect(selectLayoutWorktreeId(state)).toBe(A)
    expect(state.activeGroupIdByWorktree[A]).toBe('a-pane')
  })

  it('stays on the owner’s own layout when that workspace was opened after the pane had focus', () => {
    const store = seededStore()
    store.getState().focusGroup(A, 'a-pane')
    store.getState().setActiveWorktree(B)
    const state = relaunch(saveAndRead(store))
    expect(state.paneFocus).toBeNull()
    expect(selectLayoutWorktreeId(state)).toBe(B)
  })

  it('is dropped when the saved pane no longer shows that session', () => {
    const store = seededStore()
    store.getState().focusGroup(A, 'a-pane')
    const session = saveAndRead(store)
    const tabGroups = {
      ...session.tabGroups,
      [A]: (session.tabGroups?.[A] ?? []).map(({ sessionRef: _dropped, ...group }) => group)
    }
    const state = relaunch({ ...session, tabGroups })
    expect(state.paneFocus).toBeNull()
  })
})
