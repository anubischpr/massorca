import { useSyncExternalStore } from 'react'

/** A file the agent saved outside a paired host's worktree, asked to be shown read-only. */
export type NativeChatRecordedFileRequest = {
  sessionId: string
  path: string
  worktreeId: string
  worktreePath: string
  /** The chat's own host: the global active runtime may be another one, or none. */
  runtimeEnvironmentId: string | null
}

// Module state, not the app store: it is a transient "show this" that only the open chat renders.
let current: NativeChatRecordedFileRequest | null = null
const listeners = new Set<() => void>()

function publish(next: NativeChatRecordedFileRequest | null): void {
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function openNativeChatRecordedFile(request: NativeChatRecordedFileRequest): void {
  publish(request)
}

export function closeNativeChatRecordedFile(): void {
  publish(null)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The pending request for this chat only, so a chat in another tab never shows it. */
export function useNativeChatRecordedFileRequest(
  sessionId: string
): NativeChatRecordedFileRequest | null {
  const request = useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  )
  return request?.sessionId === sessionId ? request : null
}
