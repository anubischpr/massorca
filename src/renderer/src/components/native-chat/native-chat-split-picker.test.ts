import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../tab-bar/web-runtime-tab-move-mirror', () => ({ mirrorWebRuntimeTabMove: vi.fn() }))
vi.mock('../tab-bar/request-active-terminal-pane-split', () => ({
  requestActiveTerminalPaneSplit: vi.fn()
}))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const testStore = createTestStore()
vi.mock('@/store', () => ({ useAppStore: testStore }))
vi.mock('../../store', () => ({ useAppStore: testStore }))

const { canRunNativeChatSplitTarget, runActiveNativeChatSplit, runNativeChatSplitTarget } =
  await import('./native-chat-layout-actions')
const { requestActiveTerminalPaneSplit } =
  await import('../tab-bar/request-active-terminal-pane-split')

const WT = 'repo::/work/a'

function seedOneChat(): void {
  seedStore(testStore, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [
        makeUnifiedTab({
          id: 'chat',
          worktreeId: WT,
          groupId: 'main',
          contentType: 'agent-session',
          label: 'chat'
        })
      ]
    },
    groupsByWorktree: {
      [WT]: [makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' })]
    },
    activeGroupIdByWorktree: { [WT]: 'main' },
    layoutByWorktree: { [WT]: { type: 'leaf', groupId: 'main' } }
  })
}

beforeEach(() => {
  vi.mocked(requestActiveTerminalPaneSplit).mockClear()
  seedOneChat()
})

describe('splitting a structured chat from the shortcut or Cmd-J', () => {
  it('opens an empty pane for the picker, in the direction asked, instead of moving the chat', () => {
    expect(
      runNativeChatSplitTarget(
        { kind: 'workspace-tab', unifiedTabId: 'chat', groupId: 'main' },
        'down'
      )
    ).toBe(true)
    const state = testStore.getState()
    const groups = state.groupsByWorktree[WT].filter((group) => !group.id.startsWith('side-panel:'))
    expect(groups.map((group) => group.tabOrder)).toEqual([['chat'], []])
    expect(state.layoutByWorktree[WT]).toMatchObject({ type: 'split', direction: 'vertical' })
    expect(state.unifiedTabsByWorktree[WT][0].groupId).toBe('main')
  })

  it('splits to the right as well, from the active chat', () => {
    expect(runActiveNativeChatSplit(WT, 'main', 'right')).toBe(true)
    expect(testStore.getState().layoutByWorktree[WT]).toMatchObject({
      type: 'split',
      direction: 'horizontal'
    })
  })

  it('is available even when the chat is the only tab in its pane', () => {
    expect(
      canRunNativeChatSplitTarget({ kind: 'workspace-tab', unifiedTabId: 'chat', groupId: 'main' })
    ).toBe(true)
    expect(canRunNativeChatSplitTarget(null)).toBe(false)
  })

  it('leaves the terminal-backed chat on its own pane split', () => {
    expect(
      runNativeChatSplitTarget({ kind: 'terminal-pane', terminalTabId: 'term' }, 'right')
    ).toBe(true)
    expect(requestActiveTerminalPaneSplit).toHaveBeenCalledWith({
      tabId: 'term',
      direction: 'vertical'
    })
  })
})
