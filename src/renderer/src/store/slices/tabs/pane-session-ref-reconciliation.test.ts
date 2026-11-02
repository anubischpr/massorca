import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { projectWorktreeTabModelReconciliation } from './tabs-reconciliation'

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const store = createTestStore()

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

beforeEach(() => {
  seedStore(store, {
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

describe('reconciling a workspace that has a pane showing another workspace’s session', () => {
  it('keeps the pane and its place in the layout, though it holds no tab of its own', () => {
    const { patch } = projectWorktreeTabModelReconciliation(store.getState(), A)
    const groups = patch.groupsByWorktree?.[A] ?? store.getState().groupsByWorktree[A]
    expect(groups.map((group) => group.id)).toEqual(['a-main', 'a-pane'])
    expect(groups.find((group) => group.id === 'a-pane')?.sessionRef).toEqual({
      worktreeId: B,
      tabId: 'b-chat'
    })
    const layout = patch.layoutByWorktree?.[A] ?? store.getState().layoutByWorktree[A]
    expect(layout).toMatchObject({ type: 'split' })
  })

  it('still closes an ordinary empty pane, as before', () => {
    seedStore(store, {
      groupsByWorktree: {
        ...store.getState().groupsByWorktree,
        [A]: [
          makeTabGroup({
            id: 'a-main',
            worktreeId: A,
            tabOrder: ['a-chat'],
            activeTabId: 'a-chat'
          }),
          makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null })
        ]
      }
    })
    const { patch } = projectWorktreeTabModelReconciliation(store.getState(), A)
    expect(patch.groupsByWorktree?.[A].map((group) => group.id)).toEqual(['a-main'])
  })
})
