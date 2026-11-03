import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import type { Tab } from '../../../shared/tab-types'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { resolveNewTabTargetGroupId } from '../store/slices/tabs/pane-session-ref-new-session'

type TabsState = Pick<AppState, 'unifiedTabsByWorktree'>

/** The floating workspace shows at most one Checklist tab; a second "+" entry opens the first. */
export function findFloatingChecklistTab(state: TabsState): Tab | undefined {
  return (state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).find(
    (tab) => tab.contentType === 'checklist'
  )
}

/** Opens the Checklist tab in the floating workspace, or brings the one it already has forward. */
export function openFloatingChecklistTab(label: string): string {
  const store = useAppStore.getState()
  const existing = findFloatingChecklistTab(store)
  if (existing) {
    store.focusGroup(FLOATING_TERMINAL_WORKTREE_ID, existing.groupId)
    store.activateTab(existing.id)
    return existing.id
  }
  const tab = store.createUnifiedTab(FLOATING_TERMINAL_WORKTREE_ID, 'checklist', {
    label,
    targetGroupId: resolveNewTabTargetGroupId(store, FLOATING_TERMINAL_WORKTREE_ID),
    activate: true
  })
  store.activateTab(tab.id)
  store.focusGroup(FLOATING_TERMINAL_WORKTREE_ID, tab.groupId)
  return tab.id
}

export type ChecklistFocusInput = {
  /** On the Prototypes page: the chats behind the set in view. Null when no set is in focus. */
  prototype: { sessionId: string; originSessionId: string | null } | null
  /** The chat in focus, whether or not it has a checklist. */
  chatInFocus: string | null
  /** Sessions ordered from most to least recently active. */
  recentSessionIds: readonly string[]
  hasChecklist: (sessionId: string) => boolean
}

/**
 * The session the Checklist tab follows: the chat that generated the prototype set in focus (its own
 * chat if it has a checklist, else the chat that delegated it), else the chat in focus, else the most
 * recently active session that has a checklist.
 */
export function resolveFollowedChecklistSession(input: ChecklistFocusInput): string | null {
  const { prototype, chatInFocus, recentSessionIds, hasChecklist } = input
  if (prototype) {
    if (hasChecklist(prototype.sessionId)) {
      return prototype.sessionId
    }
    if (prototype.originSessionId !== null && hasChecklist(prototype.originSessionId)) {
      return prototype.originSessionId
    }
  }
  if (chatInFocus !== null) {
    return chatInFocus
  }
  return recentSessionIds.find(hasChecklist) ?? null
}

/** The chat the person is looking at: the focused group's active tab of the active workspace. */
export function selectChatInFocusSessionId(
  state: Pick<
    AppState,
    'activeWorktreeId' | 'activeTabType' | 'activeGroupIdByWorktree' | 'groupsByWorktree'
  > &
    TabsState
): string | null {
  const worktreeId = state.activeWorktreeId
  if (!worktreeId || state.activeTabType !== 'agent-session') {
    return null
  }
  const groupId = state.activeGroupIdByWorktree[worktreeId]
  const activeTabId = (state.groupsByWorktree[worktreeId] ?? []).find(
    (group) => group.id === groupId
  )?.activeTabId
  const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find((row) => row.id === activeTabId)
  return tab?.contentType === 'agent-session' ? tab.entityId : null
}

/** Chat sessions of every workspace, most recently focused first (`lastFocusedAt`, else creation). */
export function selectRecentChatSessionIds(state: TabsState): string[] {
  const chats = Object.entries(state.unifiedTabsByWorktree)
    .filter(([worktreeId]) => worktreeId !== FLOATING_TERMINAL_WORKTREE_ID)
    .flatMap(([, tabs]) => tabs.filter((tab) => tab.contentType === 'agent-session'))
  return chats
    .sort((a, b) => (b.lastFocusedAt ?? b.createdAt) - (a.lastFocusedAt ?? a.createdAt))
    .map((tab) => tab.entityId)
}
