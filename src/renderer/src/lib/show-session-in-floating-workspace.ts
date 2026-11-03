import type { AppState } from '@/store/types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  resolveSessionRefTab,
  selectReferencedSessions
} from '../store/slices/tabs/pane-session-ref'
import { isSessionTab, isSidePanelGroupId } from '../store/slices/tabs/side-panel-group'

/** The store surface these helpers read and write: the app store, or a test store. */
export type FloatingSessionStore = {
  getState: () => AppState
  subscribe: (listener: () => void) => () => void
}

export type ShowSessionInFloatingResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: 'floating-workspace' | 'already-shown' | 'no-session' | 'no-pane' }

/**
 * Shows a session of another workspace in the floating workspace by reference, as split view does
 * in a pane: the owner keeps the session, one floating pane shows it, and that pane takes focus.
 */
export function showSessionInFloatingWorkspace(
  ref: { worktreeId: string; tabId: string },
  store: FloatingSessionStore
): ShowSessionInFloatingResult {
  if (ref.worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return { ok: false, reason: 'floating-workspace' }
  }
  const state = store.getState()
  if (selectReferencedSessions(state).has(ref.tabId)) {
    return { ok: false, reason: 'already-shown' }
  }
  if (!resolveSessionRefTab(state, ref)) {
    return { ok: false, reason: 'no-session' }
  }
  const paneId = findEmptyFloatingPane(state) ?? createFloatingPane(store)
  if (!paneId || !store.getState().showSessionInPane(FLOATING_TERMINAL_WORKTREE_ID, paneId, ref)) {
    return { ok: false, reason: 'no-pane' }
  }
  store.getState().focusGroup(FLOATING_TERMINAL_WORKTREE_ID, paneId)
  return { ok: true, groupId: paneId }
}

/**
 * The session tab a host-published launch opens in `worktreeId`: the first session tab that is not
 * in `knownTabIds`, once the host publishes it. Resolves null when it does not appear in time.
 */
export function awaitNewSessionTab(
  args: { worktreeId: string; knownTabIds: ReadonlySet<string>; timeoutMs: number },
  store: FloatingSessionStore
): Promise<string | null> {
  const findNew = (): string | null =>
    (store.getState().unifiedTabsByWorktree[args.worktreeId] ?? []).find(
      (tab) => !args.knownTabIds.has(tab.id) && isSessionTab(tab)
    )?.id ?? null
  const immediate = findNew()
  if (immediate) {
    return Promise.resolve(immediate)
  }
  return new Promise((resolve) => {
    const finish = (tabId: string | null): void => {
      clearTimeout(timer)
      unsubscribe()
      resolve(tabId)
    }
    const unsubscribe = store.subscribe(() => {
      const tabId = findNew()
      if (tabId) {
        finish(tabId)
      }
    })
    const timer = setTimeout(() => finish(null), args.timeoutMs)
  })
}

function findEmptyFloatingPane(state: AppState): string | null {
  return (
    (state.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).find(
      (group) => !isSidePanelGroupId(group.id) && group.tabOrder.length === 0 && !group.sessionRef
    )?.id ?? null
  )
}

/** The floating workspace's first pane when it has none, else an empty split beside its focused pane. */
function createFloatingPane(store: FloatingSessionStore): string | null {
  const state = store.getState()
  const groups = state.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []
  if (groups.length === 0) {
    return state.ensureWorktreeRootGroup(FLOATING_TERMINAL_WORKTREE_ID)
  }
  const sourceGroupId =
    state.activeGroupIdByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? groups[0]?.id ?? null
  if (!sourceGroupId) {
    return null
  }
  return state.createEmptySplitGroup(FLOATING_TERMINAL_WORKTREE_ID, sourceGroupId, 'right')
}
