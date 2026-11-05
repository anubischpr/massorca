import { create } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { resolveSessionRefTab } from '../store/slices/tabs/pane-session-ref'
import { focusTerminalTabSurface } from './focus-terminal-tab-surface'
import { markAgentTerminalAsSession } from './floating-workspace-host-session'
import {
  awaitNewSessionTab,
  showSessionInFloatingWorkspace
} from './show-session-in-floating-workspace'

// Why: a launch publishes its session once its host admits it and its tab mirrors in; past this it is not coming.
const SESSION_TAB_WAIT_MS = 30_000
// Why: a workspace create runs its checkout and setup first; one still pending after this is stuck.
const NEW_WORKTREE_WAIT_MS = 10 * 60_000

/** New Session tabs whose session is starting: their create screen waits, with its composer hidden. */
export const useFloatingCreateLaunchStore = create<{
  startingTabIds: Readonly<Record<string, true>>
}>()(() => ({ startingTabIds: {} }))

export function markFloatingCreateLaunchStarted(createTabId: string): void {
  useFloatingCreateLaunchStore.setState((state) => ({
    startingTabIds: { ...state.startingTabIds, [createTabId]: true }
  }))
}

/** Ends a New Session tab's starting state; a launch that did not start leaves it behind otherwise. */
export function clearFloatingCreateLaunch(createTabId: string | null): void {
  if (
    createTabId === null ||
    !useFloatingCreateLaunchStore.getState().startingTabIds[createTabId]
  ) {
    return
  }
  useFloatingCreateLaunchStore.setState((state) => {
    const { [createTabId]: _cleared, ...startingTabIds } = state.startingTabIds
    return { startingTabIds }
  })
}

export type FloatingCreateLaunch = {
  worktreeId: string
  /** The session's tab id when the launch knows it; null when only a new session tab can name it. */
  tabId: string | null
  /** The workspace's tab ids before the launch, so the session tab it opens can be told apart. */
  knownTabIds: ReadonlySet<string>
  /** The New Session tab that waits for the session; null when none does. */
  createTabId: string | null
}

/** Shows the session a New Session launch started in the floating workspace, in place of its tab. */
export function showFloatingCreateLaunch(launch: FloatingCreateLaunch): void {
  const { worktreeId, tabId, knownTabIds, createTabId } = launch
  if (tabId !== null && resolveSessionRefTab(useAppStore.getState(), { worktreeId, tabId })) {
    showLaunchedSession(worktreeId, tabId, createTabId)
    return
  }
  void awaitNewSessionTab(
    { worktreeId, knownTabIds, timeoutMs: SESSION_TAB_WAIT_MS },
    useAppStore
  ).then((foundTabId) => {
    if (foundTabId !== null) {
      showLaunchedSession(worktreeId, foundTabId, createTabId)
      return
    }
    failFloatingCreateLaunch(
      createTabId,
      translate(
        'components.floatingWorkspace.createSessionNotReady',
        'The new session did not show up in its workspace.'
      )
    )
  })
}

function showLaunchedSession(worktreeId: string, tabId: string, createTabId: string | null): void {
  // Why: a terminal fallback has no view mode until stamped, and without one it cannot be shown by reference.
  markAgentTerminalAsSession(worktreeId, tabId)
  clearFloatingCreateLaunch(createTabId)
  const shown = showSessionInFloatingWorkspace({ worktreeId, tabId }, useAppStore, {
    replaceTabId: createTabId
  })
  if (shown.ok) {
    focusTerminalTabSurface(tabId)
    return
  }
  if (shown.reason === 'create-tab-closed') {
    return
  }
  toast.error(
    translate(
      'components.floatingWorkspace.couldNotShow',
      'Could not show this session in the floating workspace.'
    )
  )
}

/** Ends a New Session tab's wait; a message says why the session did not show, unless the tab is gone. */
function failFloatingCreateLaunch(createTabId: string | null, message: string | null): void {
  clearFloatingCreateLaunch(createTabId)
  if (message === null) {
    return
  }
  const tabStillOpen =
    createTabId === null ||
    (useAppStore.getState().unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).some(
      (tab) => tab.id === createTabId
    )
  if (tabStillOpen) {
    toast.error(message)
  }
}

export type FloatingNewWorktreeLaunch = {
  /** Filled with the id the create gives its workspace; another workspace of the repo may land first. */
  created: CreatedWorktreeSignal
  /** The create's pending entry; it is gone, or failed, when the workspace will not come. */
  creationId: string
  createTabId: string | null
}

/** Set synchronously by the create once its workspace exists; `notify` re-checks a running wait. */
export type CreatedWorktreeSignal = { worktreeId: string | null; notify: () => void }

/** How a New Session create's wait for its workspace ended. */
type NewWorktreeWait =
  | { kind: 'created'; worktreeId: string }
  | { kind: 'ended' }
  | { kind: 'timed-out' }

/** Shows the session of the workspace a New Session create makes, once that workspace has its session. */
export function showFloatingNewWorktreeLaunch(launch: FloatingNewWorktreeLaunch): void {
  void waitForNewWorktree(launch).then((wait) => {
    if (wait.kind === 'created') {
      showFloatingCreateLaunch({
        worktreeId: wait.worktreeId,
        tabId: null,
        knownTabIds: new Set(),
        createTabId: launch.createTabId
      })
      return
    }
    if (wait.kind === 'timed-out') {
      failFloatingCreateLaunch(
        launch.createTabId,
        translate(
          'components.floatingWorkspace.createSessionNotReady',
          'The new session did not show up in its workspace.'
        )
      )
      return
    }
    // Why: a failed create reports itself in its own surface; this only ends the New Session tab's wait.
    failFloatingCreateLaunch(launch.createTabId, null)
  })
}

function waitForNewWorktree(launch: FloatingNewWorktreeLaunch): Promise<NewWorktreeWait> {
  const findNew = (): string | null => {
    const worktreeId = launch.created.worktreeId
    if (worktreeId === null) {
      return null
    }
    const repos = Object.values(useAppStore.getState().worktreesByRepo)
    return repos.some((worktrees) => worktrees.some((worktree) => worktree.id === worktreeId))
      ? worktreeId
      : null
  }
  const createEnded = (): boolean => {
    const pending: AppState['pendingWorktreeCreations'][string] | undefined =
      useAppStore.getState().pendingWorktreeCreations[launch.creationId]
    return pending === undefined || pending.status === 'error'
  }
  const immediate = findNew()
  if (immediate !== null) {
    return Promise.resolve({ kind: 'created', worktreeId: immediate })
  }
  if (createEnded()) {
    return Promise.resolve({ kind: 'ended' })
  }
  return new Promise((resolve) => {
    const finish = (wait: NewWorktreeWait): void => {
      clearTimeout(timer)
      unsubscribe()
      resolve(wait)
    }
    const check = (): void => {
      const worktreeId = findNew()
      if (worktreeId !== null) {
        finish({ kind: 'created', worktreeId })
      } else if (createEnded()) {
        finish({ kind: 'ended' })
      }
    }
    // Why: the id can arrive after the store already holds that workspace, with no later store change.
    launch.created.notify = check
    const unsubscribe = useAppStore.subscribe(check)
    const timer = setTimeout(() => finish({ kind: 'timed-out' }), NEW_WORKTREE_WAIT_MS)
  })
}
