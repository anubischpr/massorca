import { beforeEach, describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  createTestStore,
  makeTabGroup,
  makeUnifiedTab,
  seedStore
} from '../store/slices/store-test-helpers'
import { selectReferencedSessions } from '../store/slices/tabs/pane-session-ref'
import { showSessionInFloatingWorkspace } from './show-session-in-floating-workspace'

const OWNER = 'repo-a::/srv/owner'
const FLOATING = FLOATING_TERMINAL_WORKTREE_ID
const store = createTestStore()

beforeEach(() => {
  seedStore(store, {
    activeWorktreeId: OWNER,
    unifiedTabsByWorktree: {
      [OWNER]: [
        makeUnifiedTab({
          id: 'owner-chat',
          worktreeId: OWNER,
          groupId: 'owner-main',
          contentType: 'agent-session',
          label: 'Owner chat'
        })
      ],
      [FLOATING]: [
        makeUnifiedTab({
          id: 'float-chat',
          worktreeId: FLOATING,
          groupId: 'float-main',
          contentType: 'agent-session',
          label: 'Floating chat'
        })
      ]
    },
    groupsByWorktree: {
      [OWNER]: [
        makeTabGroup({
          id: 'owner-main',
          worktreeId: OWNER,
          tabOrder: ['owner-chat'],
          activeTabId: 'owner-chat'
        })
      ],
      [FLOATING]: [
        makeTabGroup({
          id: 'float-main',
          worktreeId: FLOATING,
          tabOrder: ['float-chat'],
          activeTabId: 'float-chat'
        })
      ]
    },
    activeGroupIdByWorktree: { [OWNER]: 'owner-main', [FLOATING]: 'float-main' },
    layoutByWorktree: {
      [OWNER]: { type: 'leaf', groupId: 'owner-main' },
      [FLOATING]: { type: 'leaf', groupId: 'float-main' }
    }
  })
})

describe('showing another workspace session in the floating workspace', () => {
  it('shows it in a new floating pane, keeps it in its workspace, and focuses that pane', () => {
    const result = showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)

    expect(result.ok).toBe(true)
    const state = store.getState()
    const pane = (state.groupsByWorktree[FLOATING] ?? []).find((group) => group.sessionRef)
    expect(pane?.sessionRef).toEqual({ worktreeId: OWNER, tabId: 'owner-chat' })
    expect(state.activeGroupIdByWorktree[FLOATING]).toBe(pane?.id)
    expect(
      state.unifiedTabsByWorktree[OWNER]?.find((tab) => tab.id === 'owner-chat')?.groupId
    ).toBe('owner-main')
  })

  it('reuses an empty floating pane before it adds one', () => {
    seedStore(store, {
      groupsByWorktree: {
        [OWNER]: store.getState().groupsByWorktree[OWNER] ?? [],
        [FLOATING]: [
          ...(store.getState().groupsByWorktree[FLOATING] ?? []),
          makeTabGroup({ id: 'float-empty', worktreeId: FLOATING, tabOrder: [], activeTabId: null })
        ]
      }
    })

    const result = showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)

    expect(result).toEqual({ ok: true, groupId: 'float-empty' })
    expect(store.getState().groupsByWorktree[FLOATING]).toHaveLength(2)
  })

  it('refuses a session that a pane already shows', () => {
    expect(
      showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store).ok
    ).toBe(true)

    expect(
      showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)
    ).toEqual({ ok: false, reason: 'already-shown' })
  })

  it('gives the session back to its workspace when its floating pane closes', () => {
    const shown = showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)
    if (!shown.ok) {
      throw new Error('expected the session to be shown in the floating workspace')
    }

    store.getState().closeEmptyGroup(FLOATING, shown.groupId)

    const state = store.getState()
    expect(selectReferencedSessions(state).has('owner-chat')).toBe(false)
    expect(state.groupsByWorktree[FLOATING]?.some((group) => group.id === shown.groupId)).toBe(
      false
    )
    expect(state.groupsByWorktree[OWNER]?.[0]?.tabOrder).toEqual(['owner-chat'])
  })
})
