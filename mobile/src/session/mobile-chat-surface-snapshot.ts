import { useSyncExternalStore } from 'react'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { RpcClient } from '../transport/rpc-client'

/** The structured session a chat's recorded files are read from: the host that owns it and its id. */
export type MobileChatSurfaceRecordedSource = { client: RpcClient; sessionId: string }

/** What a chat's Summary and Artifacts screens read. The session screen publishes it while the chat
 *  is open; both screens push over that screen, so the chat state they show is the one on screen. */
export type MobileChatSurfaceSnapshot = {
  messages: readonly NativeChatMessage[]
  agent: string | null
  working: boolean
  /** Epoch ms the live turn started, or null when no turn is running. */
  workingStartedAt: number | null
  /** Set only on the structured lane: the one place recorded files can be read from. */
  recordedSource: MobileChatSurfaceRecordedSource | null
}

const snapshots = new Map<string, MobileChatSurfaceSnapshot>()
const listeners = new Set<() => void>()

/** One key per chat tab on one worktree of one host. */
export function mobileChatSurfaceKey(hostId: string, worktreeId: string, tabId: string): string {
  return JSON.stringify([hostId, worktreeId, tabId])
}

/** The snapshot published under a key, or null. Read by the hook and by tests. */
export function getMobileChatSurfaceSnapshot(key: string): MobileChatSurfaceSnapshot | null {
  return snapshots.get(key) ?? null
}

export function publishMobileChatSurfaceSnapshot(
  key: string,
  snapshot: MobileChatSurfaceSnapshot
): void {
  snapshots.set(key, snapshot)
  notify()
}

export function clearMobileChatSurfaceSnapshot(key: string): void {
  if (snapshots.delete(key)) {
    notify()
  }
}

/** The chat a screen is showing, or null while the session screen has not published one. */
export function useMobileChatSurfaceSnapshot(key: string | null): MobileChatSurfaceSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => (key === null ? null : getMobileChatSurfaceSnapshot(key)),
    () => null
  )
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** Test seam: forget every published chat. */
export function resetMobileChatSurfaceSnapshotsForTest(): void {
  snapshots.clear()
  notify()
}
