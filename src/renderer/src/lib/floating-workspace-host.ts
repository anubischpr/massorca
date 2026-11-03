import type { AppState } from '@/store/types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { getRuntimeEnvironmentIdForWorktree } from './worktree-runtime-owner'

/** The host value for This computer, where the floating workspace itself lives. */
export const FLOATING_HOST_THIS_COMPUTER = 'local'

export const FLOATING_HOST_NO_WORKSPACE_REASON = 'This host has no workspace yet.'

export type FloatingHostPreference = {
  /** The host the person picked in this window. */
  chosen: string | null
  /** The host a session last started on. */
  lastUsedHost: string | null
}

export type FloatingHostCreationTarget =
  | { kind: 'floating' }
  | { kind: 'workspace'; worktreeId: string; environmentId: string }
  | { kind: 'unavailable'; reason: string }

/**
 * The host new sessions start on: the person's pick, else the focused workspace's host, else the
 * last used host, else This computer. A host that is no longer paired is skipped.
 */
export function resolveFloatingWorkspaceHost(args: {
  chosen: string | null
  focusedHost: string | null
  lastUsedHost: string | null
  pairedHostIds: readonly string[]
}): string {
  const isKnown = (host: string | null): host is string =>
    host === FLOATING_HOST_THIS_COMPUTER || (host !== null && args.pairedHostIds.includes(host))
  return (
    [args.chosen, args.focusedHost, args.lastUsedHost].find(isKnown) ?? FLOATING_HOST_THIS_COMPUTER
  )
}

/** The host of the focused workspace; null when no workspace has focus or it is the floating one. */
export function selectFocusedFloatingHost(state: AppState): string | null {
  const worktreeId = state.activeWorktreeId
  if (!worktreeId || worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return null
  }
  return getRuntimeEnvironmentIdForWorktree(state, worktreeId) ?? FLOATING_HOST_THIS_COMPUTER
}

/** The host new floating sessions start on right now, following the person's pick first. */
export function selectSelectedFloatingHost(
  state: AppState,
  preference: FloatingHostPreference
): string {
  return resolveFloatingWorkspaceHost({
    chosen: preference.chosen,
    focusedHost: selectFocusedFloatingHost(state),
    lastUsedHost: preference.lastUsedHost,
    pairedHostIds: state.runtimeEnvironments.map((environment) => environment.id)
  })
}

/**
 * Where a new terminal or chat for `host` is created: the floating workspace for This computer;
 * for a paired host, its workspace in focus, else the one used most recently.
 */
export function selectFloatingHostCreationTarget(
  state: AppState,
  host: string
): FloatingHostCreationTarget {
  if (host === FLOATING_HOST_THIS_COMPUTER) {
    return { kind: 'floating' }
  }
  const workspaces = Object.values(state.worktreesByRepo)
    .flat()
    .filter(
      (worktree) =>
        worktree.id !== FLOATING_TERMINAL_WORKTREE_ID &&
        getRuntimeEnvironmentIdForWorktree(state, worktree.id) === host
    )
  const focused = workspaces.find((worktree) => worktree.id === state.activeWorktreeId)
  const mostRecent = [...workspaces].sort((a, b) => b.lastActivityAt - a.lastActivityAt)[0]
  const workspace = focused ?? mostRecent
  return workspace
    ? { kind: 'workspace', worktreeId: workspace.id, environmentId: host }
    : { kind: 'unavailable', reason: FLOATING_HOST_NO_WORKSPACE_REASON }
}

/** The workspace a remote host's new session starts in; null for This computer or a host with none. */
export function selectFloatingHostWorkspaceId(state: AppState, host: string): string | null {
  const target = selectFloatingHostCreationTarget(state, host)
  return target.kind === 'workspace' ? target.worktreeId : null
}
