import { useSyncExternalStore } from 'react'
import type { HostPiTerminalRuntime } from '../../../shared/pi-runtime-selection'

/** The Pi runtime each workspace's host answered, cached for the session so labels read it synchronously. */
const answers = new Map<string, HostPiTerminalRuntime>()
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

export function recordHostPiRuntimeAnswer(worktreeId: string, answer: HostPiTerminalRuntime): void {
  answers.set(worktreeId, answer)
  pendingWorktrees.delete(worktreeId)
  emit()
}

/**
 * Asks the host once per workspace; later and concurrent callers reuse the answer or the pending ask.
 * A null ask means the host cannot be asked yet (its owner is not known), so nothing is cached and a later
 * render asks again rather than pinning the label to unknown.
 */
export function requestHostPiRuntimeAnswer(
  worktreeId: string,
  ask: (worktreeId: string) => Promise<HostPiTerminalRuntime | null>
): void {
  if (!worktreeId || answers.has(worktreeId) || pendingWorktrees.has(worktreeId)) {
    return
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
  pendingWorktrees.clear()
  emit()
}
