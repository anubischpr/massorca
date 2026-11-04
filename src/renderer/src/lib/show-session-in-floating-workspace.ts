import type { AppState } from '@/store/types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  resolveSessionRefTab,
  selectReferencedSessions
} from '../store/slices/tabs/pane-session-ref'
import { resolveNewTabTargetGroupId } from '../store/slices/tabs/pane-session-ref-new-session'
import { isSessionTab } from '../store/slices/tabs/side-panel-group'

/** The store surface these helpers read and write: the app store, or a test store. */
export type FloatingSessionStore = {
  getState: () => AppState
  subscribe: (listener: () => void) => () => void
}

export type ShowSessionInFloatingResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: 'floating-workspace' | 'already-shown' | 'no-session' | 'no-pane' }

/**
 * Shows a session of another workspace in the floating workspace by reference: the owner keeps the
 * session, and a new tab of the focused floating group shows it, beside that group's other tabs.
 */
export function showSessionInFloatingWorkspace(
  ref: { worktreeId: string; tabId: string },
  store: FloatingSessionStore,
  options: { endsSessionOnClose?: boolean } = {}
): ShowSessionInFloatingResult {
  if (ref.worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return { ok: false, reason: 'floating-workspace' }
  }
  const state = store.getState()
  if (selectReferencedSessions(state).has(ref.tabId)) {
    return { ok: false, reason: 'already-shown' }
  }
  const target = resolveSessionRefTab(state, ref)
  if (!target) {
    return { ok: false, reason: 'no-session' }
  }
  const groupId =
    resolveNewTabTargetGroupId(store.getState(), FLOATING_TERMINAL_WORKTREE_ID) ??
    store.getState().ensureWorktreeRootGroup(FLOATING_TERMINAL_WORKTREE_ID)
  store.getState().createUnifiedTab(FLOATING_TERMINAL_WORKTREE_ID, 'session-ref', {
    entityId: ref.tabId,
    label: target.label,
    ...(target.agentSessionAgent ? { agentSessionAgent: target.agentSessionAgent } : {}),
    sessionRef: {
      worktreeId: ref.worktreeId,
      tabId: ref.tabId,
      ...(options.endsSessionOnClose ? { endsSessionOnClose: true as const } : {})
    },
    targetGroupId: groupId,
    activate: true
  })
  store.getState().focusGroup(FLOATING_TERMINAL_WORKTREE_ID, groupId)
  return { ok: true, groupId }
}

/**
 * The session tab a host-published launch opens in `worktreeId`: the first session tab that is not
 * in `knownTabIds`, once the host publishes it. Resolves null when it does not appear in time.
 */
export function awaitNewSessionTab(
  args: { worktreeId: string; knownTabIds: ReadonlySet<string>; timeoutMs: number },
  store: FloatingSessionStore
): Promise<string | null> {
  const findNew = (): string | null => {
    const state = store.getState()
    // Why: a launch the host declines as a chat falls back to a terminal that has no view mode yet;
    // its terminal row's launch agent is what names it a session, as the side-panel normalizer reads it.
    const launchedAgentRowIds = new Set(
      (state.tabsByWorktree[args.worktreeId] ?? []).flatMap((row) =>
        row.launchAgent ? [row.id] : []
      )
    )
    return (
      (state.unifiedTabsByWorktree[args.worktreeId] ?? []).find(
        (tab) =>
          !args.knownTabIds.has(tab.id) &&
          (isSessionTab(tab) ||
            (tab.contentType === 'terminal' && launchedAgentRowIds.has(tab.entityId)))
      )?.id ?? null
    )
  }
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
