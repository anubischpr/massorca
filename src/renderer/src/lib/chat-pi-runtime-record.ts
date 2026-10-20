import { useEffect, useSyncExternalStore } from 'react'
import { isPiRuntimeSelection, type PiRuntimeSelection } from '../../../shared/pi-runtime-selection'

/** The Pi runtime each structured chat's host recorded, keyed by session id, for its tab and hand-off labels. */
const chatRuntimes = new Map<string, PiRuntimeSelection>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function recordChatPiRuntime(
  sessionId: string,
  runtime: PiRuntimeSelection | undefined
): void {
  if (!sessionId || !isPiRuntimeSelection(runtime) || chatRuntimes.get(sessionId) === runtime) {
    return
  }
  chatRuntimes.set(sessionId, runtime)
  for (const listener of listeners) {
    listener()
  }
}

/** The runtime a chat's session recorded, or undefined until the host has answered for it. */
export function useChatPiRuntime(
  sessionId: string | null | undefined
): PiRuntimeSelection | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (sessionId ? chatRuntimes.get(sessionId) : undefined),
    () => undefined
  )
}

/** Records a chat's host Pi runtime as soon as its options read answers, so its tab and hand-off labels follow it. */
export function useRecordChatPiRuntime(
  sessionId: string,
  runtime: PiRuntimeSelection | undefined
): void {
  useEffect(() => recordChatPiRuntime(sessionId, runtime), [sessionId, runtime])
}
