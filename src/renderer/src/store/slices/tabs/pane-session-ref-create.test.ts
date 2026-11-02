import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../store-test-helpers')
const { makeWorktree } = await import('../worktrees-slice-test-fixtures')
const { installSidePanelNormalizer } = await import('./side-panel-normalizer')
const { sidePanelGroupId } = await import('./side-panel-group')

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const store = createTestStore()

beforeEach(() => {
  seedStore(store, {
    repos: [{ id: 'repo', path: '/work', displayName: 'Repo', badgeColor: '#000', addedAt: 0 }],
    worktreesByRepo: {
      repo: [makeWorktree({ id: A, repoId: 'repo' }), makeWorktree({ id: B, repoId: 'repo' })]
    },
    activeWorktreeId: A,
    paneFocus: null,
    unifiedTabsByWorktree: {
      [A]: [
        makeUnifiedTab({
          id: 'a-chat',
          worktreeId: A,
          groupId: 'a-main',
          contentType: 'agent-session',
          label: 'a-chat'
        })
      ],
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

describe('a new terminal tab while a pane shows another workspace’s session has focus', () => {
  it('goes to the session owner’s side panel, which is the one on screen', async () => {
    const stop = installSidePanelNormalizer(store)
    store.getState().focusGroup(A, 'a-pane')
    const state = store.getState()
    const targetGroupId = state.activeGroupIdByWorktree[state.activeWorktreeId ?? ''] ?? ''
    await state.openNewTerminalTabInActiveWorkspace(targetGroupId)
    const after = store.getState()
    const created = (after.unifiedTabsByWorktree[B] ?? []).find(
      (tab) => tab.contentType === 'terminal'
    )
    expect(created?.groupId).toBe(sidePanelGroupId(B))
    expect(
      (after.unifiedTabsByWorktree[A] ?? []).some((tab) => tab.contentType === 'terminal')
    ).toBe(false)
    expect(after.groupsByWorktree[B].some((group) => group.id === created?.groupId)).toBe(true)
    stop()
  })
})
