// The design folders each chat's prototype requests are bound to, from the latest listing of the hosts.
// A chat's Artifacts list reads it to leave those files out.
import { useSyncExternalStore } from 'react'
import { boundDesignFolderOf } from '../../../../shared/prototype-design-folders'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'

const NONE: readonly string[] = []
let foldersBySession = new Map<string, readonly string[]>()
const listeners = new Set<() => void>()

/** Replaces the bound folders with those of one listing of every host's sets. */
export function recordBoundDesignFolders(sets: readonly PrototypeListedSet[]): void {
  const next = new Map<string, string[]>()
  for (const set of sets) {
    const folder = boundDesignFolderOf(set)
    if (folder === null) {
      continue
    }
    const folders = next.get(set.sessionId) ?? []
    if (!folders.includes(folder)) {
      folders.push(folder)
    }
    next.set(set.sessionId, folders)
  }
  if (sameFolders(foldersBySession, next)) {
    return
  }
  foldersBySession = next
  for (const listener of listeners) {
    listener()
  }
}

/** The design folders bound to one chat; the list changes only when a listing finds a different binding. */
export function useBoundDesignFolders(sessionId: string | undefined): readonly string[] {
  return useSyncExternalStore(subscribe, () =>
    sessionId === undefined ? NONE : (foldersBySession.get(sessionId) ?? NONE)
  )
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function sameFolders(
  left: ReadonlyMap<string, readonly string[]>,
  right: ReadonlyMap<string, readonly string[]>
): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const [sessionId, folders] of right) {
    const known = left.get(sessionId)
    if (
      known === undefined ||
      known.length !== folders.length ||
      folders.some((folder, index) => known[index] !== folder)
    ) {
      return false
    }
  }
  return true
}
