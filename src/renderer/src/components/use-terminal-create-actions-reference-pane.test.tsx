// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminalColdActivationController } from './terminal-cold-activation'

const mocks = vi.hoisted(() => ({ launchAgentInNewTab: vi.fn() }))

vi.mock('@/lib/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: (...args: unknown[]) => mocks.launchAgentInNewTab(...args)
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), message: vi.fn() } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { useTerminalCreateActions } = await import('./use-terminal-create-actions')
const { selectLayoutWorktreeId } = await import('../store/slices/tabs/pane-session-ref')

const A = 'repo::/work/a'
const B = 'repo::/work/b'

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

function newAgentTab(): void {
  const { activeWorktreeId } = store.getState()
  renderHook(() =>
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: handleNewAgentTab reads only activeWorktreeId from the controller.
    useTerminalCreateActions({ activeWorktreeId } as unknown as TerminalColdActivationController)
  ).result.current.handleNewAgentTab('claude')
}

beforeEach(() => {
  mocks.launchAgentInNewTab.mockReset()
  seedStore(store, {
    activeWorktreeId: A,
    paneFocus: null,
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
})

describe('a new agent session while a pane shows another workspace’s session', () => {
  it('opens in that pane, in the layout on screen, instead of the owner’s hidden layout', () => {
    mocks.launchAgentInNewTab.mockReturnValue({ surface: { kind: 'local-terminal', tabId: 'x' } })
    store.getState().focusGroup(A, 'a-pane')
    newAgentTab()
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: A, groupId: 'a-pane' })
    )
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(A)
    expect(state.paneFocus).toBeNull()
    expect(selectLayoutWorktreeId(state)).toBe(A)
    expect(state.groupsByWorktree[A].find((group) => group.id === 'a-pane')?.sessionRef).toBe(
      undefined
    )
  })

  it('shows the other workspace’s session in the pane again when the launch fails', () => {
    mocks.launchAgentInNewTab.mockReturnValue(null)
    store.getState().focusGroup(A, 'a-pane')
    newAgentTab()
    const state = store.getState()
    expect(state.groupsByWorktree[A].find((group) => group.id === 'a-pane')?.sessionRef).toEqual({
      worktreeId: B,
      tabId: 'b-chat'
    })
    expect(state.activeWorktreeId).toBe(B)
    expect(state.paneFocus).toEqual({ layoutWorktreeId: A, ownerWorktreeId: B, groupId: 'a-pane' })
  })

  it('keeps an ordinary pane’s launch in its own workspace and pane', () => {
    mocks.launchAgentInNewTab.mockReturnValue({ surface: { kind: 'local-terminal', tabId: 'x' } })
    store.getState().focusGroup(A, 'a-main')
    newAgentTab()
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: A, groupId: 'a-main' })
    )
  })
})
