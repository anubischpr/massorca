import { useSyncExternalStore } from 'react'
import type { HostPiTerminalRuntime } from '../../../shared/pi-runtime-selection'

/** The Pi runtime each workspace's host answered, cached for the session so labels read it synchronously. */
const answers = new Map<string, HostPiTerminalRuntime>()
/** Workspaces whose last answer was a failed `unknown`; they are asked again once per activation. */
const failedWorkspaces = new Set<string>()
const retryOnActivation = new Set<string>()
const pendingWorktrees = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Records an answer. `unknown` is a failed ask (timeout or error), so only the next activation asks again. */
export function recordHostPiRuntimeAnswer(worktreeId: string, answer: HostPiTerminalRuntime): void {
  answers.set(worktreeId, answer)
  pendingWorktrees.delete(worktreeId)
  if (answer === 'unknown') {
    failedWorkspaces.add(worktreeId)
  } else {
    failedWorkspaces.delete(worktreeId)
  }
  retryOnActivation.delete(worktreeId)
  emit()
}

/** Called when a workspace becomes active: a failed answer may be asked again, once, for this activation. */
export function allowHostPiRuntimeRetryOnActivation(worktreeId: string): void {
  if (failedWorkspaces.has(worktreeId)) {
    retryOnActivation.add(worktreeId)
  }
}

/**
 * Asks the host once per workspace; later and concurrent callers reuse the answer or the pending ask.
 * A failed answer is asked again only after the workspace's next activation. A null ask means the host
 * cannot be asked yet, so nothing is cached and a later call asks again.
 */
export function requestHostPiRuntimeAnswer(
  worktreeId: string,
  ask: (worktreeId: string) => Promise<HostPiTerminalRuntime | null>
): void {
  if (!worktreeId || pendingWorktrees.has(worktreeId)) {
    return
  }
  if (answers.has(worktreeId)) {
    if (!failedWorkspaces.has(worktreeId) || !retryOnActivation.has(worktreeId)) {
      return
    }
    retryOnActivation.delete(worktreeId)
  }
  pendingWorktrees.add(worktreeId)
  ask(worktreeId).then(
    (answer) => {
      if (answer === null) {
        pendingWorktrees.delete(worktreeId)
        return
      }
      recordHostPiRuntimeAnswer(worktreeId, answer)
    },
    () => recordHostPiRuntimeAnswer(worktreeId, 'unknown')
  )
}

/** The host's cached Pi answer for a workspace; undefined until it has answered. */
export function readHostPiRuntimeAnswer(worktreeId: string): HostPiTerminalRuntime | undefined {
  return worktreeId ? answers.get(worktreeId) : undefined
}

export function useHostPiRuntimeAnswer(worktreeId: string): HostPiTerminalRuntime | undefined {
  return useSyncExternalStore(
    subscribe,
    () => readHostPiRuntimeAnswer(worktreeId),
    () => undefined
  )
}

/** Test seam: forgets every recorded answer and pending ask. */
export function resetHostPiRuntimeAnswers(): void {
  answers.clear()
  failedWorkspaces.clear()
  retryOnActivation.clear()
  pendingWorktrees.clear()
  emit()
}
