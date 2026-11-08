// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { makeTabGroup, makeUnifiedTab, seedStore } from '../store/slices/store-test-helpers'
import { selectReferencedSessions } from '../store/slices/tabs/pane-session-ref'

const OWNER = 'repo-a::/srv/owner'
const FLOATING = FLOATING_TERMINAL_WORKTREE_ID
const HOST = 'env-pv'

const mocks = vi.hoisted(() => ({ createTerminal: vi.fn(), toastError: vi.fn() }))

// Why: the real app store is replaced by the test store built from the real slices, so tab, reference and surface logic run as in the app.
vi.mock('@/store', async () => {
  const { createTestStore } = await import('../store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
// Why: the host RPC is the process boundary; each test plays the host's publication into the store.
vi.mock('../runtime/web-runtime-terminal-creation', () => ({
  createWebRuntimeSessionTerminal: mocks.createTerminal
}))
vi.mock('./focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, info: vi.fn() } }))

import { useAppStore } from '@/store'
import { startTerminalOnHostWorkspace } from './floating-workspace-host-session'

function ownerSnapshot() {
  const state = useAppStore.getState()
  return {
    groups: state.groupsByWorktree[OWNER],
    layout: state.layoutByWorktree[OWNER],
    activeGroupId: state.activeGroupIdByWorktree[OWNER]
  }
}

/** The host mirror adds a tab to the owner's main group without activating it. */
function publishOwnerTab(id: string, contentType: 'terminal' | 'agent-session'): void {
  useAppStore.setState((state) => ({
    unifiedTabsByWorktree: {
      ...state.unifiedTabsByWorktree,
      [OWNER]: [
        ...(state.unifiedTabsByWorktree[OWNER] ?? []),
        makeUnifiedTab({
          id,
          worktreeId: OWNER,
          groupId: 'owner-main',
          contentType,
          ...(contentType === 'terminal' ? { viewMode: 'terminal' as const } : {}),
          label: id
        })
      ]
    },
    groupsByWorktree: {
      ...state.groupsByWorktree,
      [OWNER]: (state.groupsByWorktree[OWNER] ?? []).map((group) =>
        group.id === 'owner-main' ? { ...group, tabOrder: [...group.tabOrder, id] } : group
      )
    }
  }))
}

beforeEach(() => {
  mocks.createTerminal.mockReset()
  mocks.toastError.mockReset()
  seedStore(useAppStore, {
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

describe('a new terminal started in the floating workspace on a paired host', () => {
  it('shows the new terminal and leaves the owner session where it was', async () => {
    mocks.createTerminal.mockImplementation(async () => {
      publishOwnerTab('host-terminal', 'terminal')
      return { status: 'created' }
    })
    const before = ownerSnapshot()

    await startTerminalOnHostWorkspace(OWNER, HOST)
    await vi.waitFor(() => {
      expect(
        (useAppStore.getState().unifiedTabsByWorktree[FLOATING] ?? []).some(
          (tab) => tab.contentType === 'session-ref'
        )
      ).toBe(true)
    })

    const state = useAppStore.getState()
    const ref = (state.unifiedTabsByWorktree[FLOATING] ?? []).find(
      (tab) => tab.contentType === 'session-ref'
    )
    expect(ref?.sessionRef).toEqual({
      worktreeId: OWNER,
      tabId: 'host-terminal',
      endsSessionOnClose: true
    })
    expect(state.groupsByWorktree[FLOATING]?.[0]?.activeTabId).toBe(ref?.id)
    const after = ownerSnapshot()
    expect(after.layout).toEqual(before.layout)
    expect(after.activeGroupId).toBe(before.activeGroupId)
    expect(after.groups?.[0]?.activeTabId).toBe('owner-chat')
    expect(selectReferencedSessions(state).has('owner-chat')).toBe(false)
  })

  it('does not take a session another launch publishes first for its own terminal', async () => {
    // Why: a New Session starting in the same workspace publishes its chat while the terminal is still being created.
    mocks.createTerminal.mockImplementation(async () => {
      publishOwnerTab('started-chat', 'agent-session')
      publishOwnerTab('host-terminal', 'terminal')
      return { status: 'created' }
    })

    await startTerminalOnHostWorkspace(OWNER, HOST)
    await vi.waitFor(() => {
      expect(
        (useAppStore.getState().unifiedTabsByWorktree[FLOATING] ?? []).some(
          (tab) => tab.contentType === 'session-ref'
        )
      ).toBe(true)
    })

    const state = useAppStore.getState()
    const referenced = selectReferencedSessions(state)
    expect(referenced.has('host-terminal')).toBe(true)
    expect(referenced.has('started-chat')).toBe(false)
    expect(referenced.has('owner-chat')).toBe(false)
    expect(state.groupsByWorktree[OWNER]?.[0]?.activeTabId).toBe('owner-chat')
  })
})
