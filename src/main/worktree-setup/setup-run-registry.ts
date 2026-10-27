// The PTYs Orca starts for a create-chat worktree's setup script. They have no tab, so this registry
// (not the tab model) keeps them alive across a renderer reload, names them to the chat roster, and
// stops them. Main owns it, so a renderer reload leaves the run and its row in place.

import { worktreeSetupPtyIdFromTaskId } from '../../shared/worktree-setup-row'

export type WorktreeSetupRunState = 'running' | 'completed' | 'stopped' | 'failed'

export type WorktreeSetupRun = {
  ptyId: string
  worktreeId: string
  startedAt: number
  state: WorktreeSetupRunState
  /** The PTY's exit code once it settles; absent while it runs. */
  exitCode?: number
  settledAt?: number
  stopRequested: boolean
}

type StopPty = (ptyId: string) => Promise<unknown>

const runsByPtyId = new Map<string, WorktreeSetupRun>()
const sessionIdsByWorktreeId = new Map<string, Set<string>>()
const listeners = new Set<(worktreeId: string) => void>()
let stopPty: StopPty | null = null

function notify(worktreeId: string): void {
  for (const listener of listeners) {
    listener(worktreeId)
  }
}

export function registerWorktreeSetupRun(args: {
  ptyId: string
  worktreeId: string
  startedAt: number
}): void {
  runsByPtyId.set(args.ptyId, { ...args, state: 'running', stopRequested: false })
}

/** The workspace a registered setup run belongs to, or null for a PTY that is not one. */
export function worktreeSetupRunWorktreeId(ptyId: string): string | null {
  return runsByPtyId.get(ptyId)?.worktreeId ?? null
}

/** Whether a PTY is a registered setup run; the reload orphan sweep spares these. */
export function isWorktreeSetupRunPty(ptyId: string): boolean {
  return runsByPtyId.has(ptyId)
}

/** Binds a worktree's runs to the chat session created for it, so the session's roster shows them. */
export function bindWorktreeSetupRunsToSession(args: {
  worktreeId: string
  sessionId: string
}): void {
  const sessionIds = sessionIdsByWorktreeId.get(args.worktreeId) ?? new Set<string>()
  sessionIds.add(args.sessionId)
  sessionIdsByWorktreeId.set(args.worktreeId, sessionIds)
  notify(args.worktreeId)
}

/** The sessions whose roster shows a worktree's setup runs; a change to them republishes it. */
export function worktreeSetupRunSessionIds(worktreeId: string): readonly string[] {
  return [...(sessionIdsByWorktreeId.get(worktreeId) ?? [])]
}

/** The setup runs a session's roster shows: every run of the worktree the session was bound to. */
export function worktreeSetupRunsForSession(sessionId: string): WorktreeSetupRun[] {
  return [...runsByPtyId.values()].filter((run) =>
    sessionIdsByWorktreeId.get(run.worktreeId)?.has(sessionId)
  )
}

/** Settles a run from its PTY's exit. A user stop reads as stopped, whatever code the kill left. */
export function settleWorktreeSetupRunPty(ptyId: string, exitCode: number, now: number): void {
  const run = runsByPtyId.get(ptyId)
  if (!run || run.state !== 'running') {
    return
  }
  run.exitCode = exitCode
  run.settledAt = now
  run.state = run.stopRequested ? 'stopped' : exitCode === 0 ? 'completed' : 'failed'
  notify(run.worktreeId)
}

/**
 * Stops a setup run named by a roster row, for the session that shows it. Returns false for any id
 * the registry does not hold for that session, so the caller routes it to the provider as before.
 */
export async function stopWorktreeSetupRunForSession(args: {
  taskId: string | undefined
  sessionId: string
}): Promise<boolean> {
  const ptyId = args.taskId === undefined ? null : worktreeSetupPtyIdFromTaskId(args.taskId)
  const run = ptyId === null ? undefined : runsByPtyId.get(ptyId)
  if (
    !run ||
    run.state !== 'running' ||
    !worktreeSetupRunsForSession(args.sessionId).includes(run)
  ) {
    return false
  }
  if (!stopPty) {
    return false
  }
  run.stopRequested = true
  try {
    await stopPty(run.ptyId)
    return true
  } catch (error) {
    run.stopRequested = false
    console.warn('[worktree-setup] stop failed', run.ptyId, error)
    return false
  }
}

/** Main's PTY kill, injected where the PTY handlers are installed. */
export function setWorktreeSetupRunStopper(stop: StopPty): void {
  stopPty = stop
}

/** Subscribes to roster changes: a run starting, settling, or being bound to a session. */
export function onWorktreeSetupRunsChanged(listener: (worktreeId: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function _resetWorktreeSetupRunRegistryForTest(): void {
  runsByPtyId.clear()
  sessionIdsByWorktreeId.clear()
  listeners.clear()
  stopPty = null
}
