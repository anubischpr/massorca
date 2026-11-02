import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const testStore = createTestStore()
vi.mock('../../store', () => ({ useAppStore: testStore }))
vi.mock('@/lib/floating-workspace-focus-reclaim', () => ({
  armFloatingPanelReclaimIntent: vi.fn()
}))
vi.mock('@/lib/floating-workspace-terminal-actions', () => ({
  isFloatingWorkspacePanelFocused: () => false
}))
vi.mock('@/store/selectors', () => ({ selectFloatingVisibleTabCount: () => 0 }))

const { captureWorkspaceEmptiedReaction } = await import('./workspace-emptied-reaction')

const A = 'repo::/work/a'
const B = 'repo::/work/b'

/** Workspace A has just lost its last own tab; a pane of its layout may show B's session. */
function seedEmptied(withReference: boolean): void {
  seedStore(testStore, {
    activeWorktreeId: A,
    paneFocus: null,
    unifiedTabsByWorktree: {
      [A]: [],
      [B]: [
        makeUnifiedTab({
          id: 'b-chat',
          worktreeId: B,
          groupId: 'b-main',
          contentType: 'agent-session',
          label: 'b-chat'
        })
      ]
    },
    groupsByWorktree: {
      [A]: [
        {
          ...makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null }),
          ...(withReference ? { sessionRef: { worktreeId: B, tabId: 'b-chat' } } : {})
        }
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    activeGroupIdByWorktree: { [A]: 'a-pane', [B]: 'b-main' },
    layoutByWorktree: {
      [A]: { type: 'leaf', groupId: 'a-pane' },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  })
}

beforeEach(() => vi.clearAllMocks())

describe('what closing the last tab does to the selected workspace', () => {
  it('keeps a workspace selected while a pane of its layout shows another workspace’s session', () => {
    seedEmptied(true)
    captureWorkspaceEmptiedReaction(A)()
    expect(testStore.getState().activeWorktreeId).toBe(A)
  })

  it('still leaves a workspace that has no tabs and shows nothing', () => {
    seedEmptied(false)
    captureWorkspaceEmptiedReaction(A)()
    expect(testStore.getState().activeWorktreeId).toBeNull()
  })
})
