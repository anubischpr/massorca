import { describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { parseWorkspaceSession } from '../../../shared/workspace-session-schema'

const { createTestStore, makeUnifiedTab, seedStore } =
  await import('../store/slices/store-test-helpers')
const testStore = createTestStore()
vi.mock('../store', () => ({ useAppStore: testStore }))

const {
  findFloatingChecklistTab,
  openFloatingChecklistTab,
  resolveFollowedChecklistSession,
  selectChatInFocusSessionId,
  selectRecentChatSessionIds
} = await import('./floating-workspace-checklist-tab')

const has =
  (...ids: string[]) =>
  (id: string) =>
    ids.includes(id)

describe('the session the Checklist tab follows', () => {
  it('prefers the chat that generated the prototype set in focus', () => {
    expect(
      resolveFollowedChecklistSession({
        prototype: { sessionId: 'own', originSessionId: 'origin' },
        chatInFocus: 'focus',
        recentSessionIds: ['recent'],
        hasChecklist: has('own', 'origin', 'focus', 'recent')
      })
    ).toBe('own')
  })

  it('falls back to the chat that delegated the set when its own chat has no checklist', () => {
    expect(
      resolveFollowedChecklistSession({
        prototype: { sessionId: 'own', originSessionId: 'origin' },
        chatInFocus: 'focus',
        recentSessionIds: [],
        hasChecklist: has('origin')
      })
    ).toBe('origin')
  })

  it('uses the chat in focus when the set has no checklist behind it, or off the Prototypes page', () => {
    const base = { chatInFocus: 'focus', recentSessionIds: ['recent'], hasChecklist: has('recent') }
    expect(
      resolveFollowedChecklistSession({
        ...base,
        prototype: { sessionId: 'own', originSessionId: null }
      })
    ).toBe('focus')
    expect(resolveFollowedChecklistSession({ ...base, prototype: null })).toBe('focus')
  })

  it('takes the most recent session with a checklist when no chat is in focus', () => {
    expect(
      resolveFollowedChecklistSession({
        prototype: null,
        chatInFocus: null,
        recentSessionIds: ['newest', 'older', 'oldest'],
        hasChecklist: has('older', 'oldest')
      })
    ).toBe('older')
    expect(
      resolveFollowedChecklistSession({
        prototype: null,
        chatInFocus: null,
        recentSessionIds: ['newest'],
        hasChecklist: has()
      })
    ).toBeNull()
  })
})

describe('reading focus and activity from the store', () => {
  const WT = 'repo::/work/a'
  const chat = (id: string, lastFocusedAt: number) => ({
    ...makeUnifiedTab({
      id: `tab-${id}`,
      worktreeId: WT,
      groupId: 'g',
      contentType: 'agent-session'
    }),
    entityId: id,
    lastFocusedAt
  })

  it('reads the chat in focus from the active group, and none when a terminal is active', () => {
    seedStore(testStore, {
      activeWorktreeId: WT,
      activeTabType: 'agent-session',
      activeGroupIdByWorktree: { [WT]: 'g' },
      groupsByWorktree: {
        [WT]: [{ id: 'g', worktreeId: WT, activeTabId: 'tab-b', tabOrder: ['tab-a', 'tab-b'] }]
      } as never,
      unifiedTabsByWorktree: { [WT]: [chat('a', 1), chat('b', 5)] }
    })
    expect(selectChatInFocusSessionId(testStore.getState())).toBe('b')
    seedStore(testStore, { activeTabType: 'terminal' })
    expect(selectChatInFocusSessionId(testStore.getState())).toBeNull()
  })

  it('orders chats by when they were last focused', () => {
    seedStore(testStore, { unifiedTabsByWorktree: { [WT]: [chat('a', 1), chat('b', 5)] } })
    expect(selectRecentChatSessionIds(testStore.getState())).toEqual(['b', 'a'])
  })
})

describe('the Checklist tab', () => {
  it('opens once and brings the same tab forward the second time', () => {
    seedStore(testStore, { unifiedTabsByWorktree: {}, groupsByWorktree: {}, layoutByWorktree: {} })
    const first = openFloatingChecklistTab('Checklist')
    const second = openFloatingChecklistTab('Checklist')
    expect(second).toBe(first)
    const tabs = testStore.getState().unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]
    expect(tabs.filter((tab) => tab.contentType === 'checklist')).toHaveLength(1)
    expect(findFloatingChecklistTab(testStore.getState())?.label).toBe('Checklist')
  })

  it('survives a session save and restore', () => {
    const tab = findFloatingChecklistTab(testStore.getState())!
    const parsed = parseWorkspaceSession({
      activeRepoId: null,
      activeWorktreeId: null,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {},
      unifiedTabs: { [FLOATING_TERMINAL_WORKTREE_ID]: [JSON.parse(JSON.stringify(tab))] }
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.unifiedTabs?.[FLOATING_TERMINAL_WORKTREE_ID]?.[0]).toMatchObject({
        id: tab.id,
        contentType: 'checklist',
        label: 'Checklist'
      })
    }
  })
})
