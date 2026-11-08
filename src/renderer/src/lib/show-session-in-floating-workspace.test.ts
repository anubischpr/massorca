import { beforeEach, describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  createTestStore,
  makeTab,
  makeTabGroup,
  makeUnifiedTab,
  seedStore
} from '../store/slices/store-test-helpers'
import {
  referencedPlacement,
  selectReferencedSessions
} from '../store/slices/tabs/pane-session-ref'
import {
  awaitNewSessionTab,
  showSessionInFloatingWorkspace
} from './show-session-in-floating-workspace'

const OWNER = 'repo-a::/srv/owner'
const FLOATING = FLOATING_TERMINAL_WORKTREE_ID
const store = createTestStore()

function floatingTabsOf(contentType: string) {
  return (store.getState().unifiedTabsByWorktree[FLOATING] ?? []).filter(
    (tab) => tab.contentType === contentType
  )
}

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
          id: 'float-checklist',
          worktreeId: FLOATING,
          groupId: 'float-main',
          contentType: 'checklist',
          label: 'Checklist'
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
          tabOrder: ['float-checklist'],
          activeTabId: 'float-checklist'
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
  it('adds a session tab next to the existing floating tab, with no split pane', () => {
    const result = showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)

    expect(result).toEqual({ ok: true, groupId: 'float-main' })
    const state = store.getState()
    expect(state.groupsByWorktree[FLOATING]).toHaveLength(1)
    const [sessionTab] = floatingTabsOf('session-ref')
    expect(sessionTab?.sessionRef).toEqual({ worktreeId: OWNER, tabId: 'owner-chat' })
    expect(sessionTab?.groupId).toBe('float-main')
    expect(state.groupsByWorktree[FLOATING]?.[0]?.tabOrder).toEqual([
      'float-checklist',
      sessionTab?.id
    ])
    expect(state.groupsByWorktree[FLOATING]?.[0]?.activeTabId).toBe(sessionTab?.id)
    expect(state.activeGroupIdByWorktree[FLOATING]).toBe('float-main')
  })

  it('keeps the owner session in its workspace', () => {
    showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)

    const state = store.getState()
    expect(
      state.unifiedTabsByWorktree[OWNER]?.find((tab) => tab.id === 'owner-chat')?.groupId
    ).toBe('owner-main')
    expect(state.groupsByWorktree[OWNER]?.[0]?.tabOrder).toEqual(['owner-chat'])
  })

  it('keeps every floating tab when another tab is added after the session tab', () => {
    showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)
    store.getState().createUnifiedTab(FLOATING, 'checklist', {
      label: 'Second checklist',
      targetGroupId: 'float-main',
      activate: true
    })

    const state = store.getState()
    const [sessionTab] = floatingTabsOf('session-ref')
    expect(state.groupsByWorktree[FLOATING]).toHaveLength(1)
    expect(state.groupsByWorktree[FLOATING]?.[0]?.tabOrder).toHaveLength(3)
    expect(state.groupsByWorktree[FLOATING]?.[0]?.tabOrder).toContain(sessionTab?.id)
    expect(selectReferencedSessions(state).has('owner-chat')).toBe(true)
    // Why: while another floating tab is active, the owner keeps showing its session.
    expect(
      referencedPlacement(selectReferencedSessions(state), 'owner-chat', FLOATING, {
        [FLOATING]: 'float-main'
      })
    ).toBeNull()
  })

  it('refuses a session that the floating workspace already shows', () => {
    expect(
      showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store).ok
    ).toBe(true)

    expect(
      showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)
    ).toEqual({ ok: false, reason: 'already-shown' })
    expect(floatingTabsOf('session-ref')).toHaveLength(1)
  })

  it('refuses a session that does not exist and a session of the floating workspace itself', () => {
    expect(showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'gone' }, store)).toEqual({
      ok: false,
      reason: 'no-session'
    })
    expect(
      showSessionInFloatingWorkspace({ worktreeId: FLOATING, tabId: 'float-checklist' }, store)
    ).toEqual({ ok: false, reason: 'floating-workspace' })
  })

  it('creates the floating group when the workspace is empty', () => {
    const { [FLOATING]: _floatingLayout, ...otherLayouts } = store.getState().layoutByWorktree
    seedStore(store, {
      unifiedTabsByWorktree: { ...store.getState().unifiedTabsByWorktree, [FLOATING]: [] },
      groupsByWorktree: { ...store.getState().groupsByWorktree, [FLOATING]: [] },
      layoutByWorktree: otherLayouts
    })

    const result = showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)

    expect(result.ok).toBe(true)
    const state = store.getState()
    expect(state.groupsByWorktree[FLOATING]).toHaveLength(1)
    expect(floatingTabsOf('session-ref')).toHaveLength(1)
  })

  it('gives the session back to its workspace when its floating tab closes', () => {
    showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store)
    const [sessionTab] = floatingTabsOf('session-ref')
    if (!sessionTab) {
      throw new Error('expected a session tab in the floating workspace')
    }

    store.getState().closeUnifiedTab(sessionTab.id)

    const state = store.getState()
    expect(selectReferencedSessions(state).has('owner-chat')).toBe(false)
    expect(floatingTabsOf('session-ref')).toHaveLength(0)
    expect(state.groupsByWorktree[FLOATING]?.[0]?.tabOrder).toEqual(['float-checklist'])
    expect(state.unifiedTabsByWorktree[OWNER]?.some((tab) => tab.id === 'owner-chat')).toBe(true)
    expect(state.groupsByWorktree[OWNER]?.[0]?.tabOrder).toEqual(['owner-chat'])
  })
})

describe('waiting for the session a host publishes', () => {
  it('finds the terminal a host opens after declining a chat, though it has no view mode yet', async () => {
    const before = store.getState()
    store.setState({
      tabsByWorktree: {
        ...before.tabsByWorktree,
        [OWNER]: [makeTab({ id: 'pi-terminal', worktreeId: OWNER, launchAgent: 'pi' })]
      },
      unifiedTabsByWorktree: {
        ...before.unifiedTabsByWorktree,
        [OWNER]: [
          ...(before.unifiedTabsByWorktree[OWNER] ?? []),
          makeUnifiedTab({
            id: 'pi-terminal',
            entityId: 'pi-terminal',
            worktreeId: OWNER,
            groupId: 'owner-main',
            contentType: 'terminal',
            label: 'Gentle Shell'
          })
        ]
      }
    })

    await expect(
      awaitNewSessionTab(
        { worktreeId: OWNER, knownTabIds: new Set(['owner-chat']), timeoutMs: 10 },
        store
      )
    ).resolves.toBe('pi-terminal')
  })

  it('ignores a plain terminal that no agent launched', async () => {
    const before = store.getState()
    store.setState({
      unifiedTabsByWorktree: {
        ...before.unifiedTabsByWorktree,
        [OWNER]: [
          ...(before.unifiedTabsByWorktree[OWNER] ?? []),
          makeUnifiedTab({
            id: 'shell',
            entityId: 'shell',
            worktreeId: OWNER,
            groupId: 'owner-main',
            contentType: 'terminal',
            label: 'Terminal'
          })
        ]
      }
    })

    await expect(
      awaitNewSessionTab(
        { worktreeId: OWNER, knownTabIds: new Set(['owner-chat']), timeoutMs: 10 },
        store
      )
    ).resolves.toBeNull()
  })
})

describe('giving a New Session tab place to the session it starts', () => {
  it('takes the New Session tab place and closes it', () => {
    store.getState().createUnifiedTab(FLOATING, 'create-session', {
      label: 'New Session',
      targetGroupId: 'float-main',
      activate: true
    })
    const [createTab] = floatingTabsOf('create-session')

    const result = showSessionInFloatingWorkspace(
      { worktreeId: OWNER, tabId: 'owner-chat' },
      store,
      {
        replaceTabId: createTab?.id ?? null
      }
    )

    expect(result).toEqual({ ok: true, groupId: 'float-main' })
    expect(floatingTabsOf('create-session')).toHaveLength(0)
    const [sessionTab] = floatingTabsOf('session-ref')
    const group = store.getState().groupsByWorktree[FLOATING]?.[0]
    expect(group?.tabOrder).toEqual(['float-checklist', sessionTab?.id])
    expect(group?.activeTabId).toBe(sessionTab?.id)
  })

  it('shows nothing when the New Session tab was closed while its session started', () => {
    expect(
      showSessionInFloatingWorkspace({ worktreeId: OWNER, tabId: 'owner-chat' }, store, {
        replaceTabId: 'closed-create-tab'
      })
    ).toEqual({ ok: false, reason: 'create-tab-closed' })
    expect(floatingTabsOf('session-ref')).toHaveLength(0)
  })
})
