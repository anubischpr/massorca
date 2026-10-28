// The seen background work of each chat, kept across remounts and reconnects. Module-level, so a
// chat that unmounts (or a stream that remounts it) still lists the rows it saw end. Bounded to the
// chats used most recently, so a long-lived app never grows it without limit.

import { emptySeenBackgroundWork, type SeenBackgroundWork } from './mobile-seen-background-work'

/** How many chats keep their seen work; the least recently used falls off first. */
export const MAX_SEEN_BACKGROUND_CHATS = 12

const seenByChat = new Map<string, SeenBackgroundWork>()

/** One chat's seen work, or an empty fold for a chat not kept yet. Reading marks it recently used. */
export function readSeenBackgroundWork(scopeKey: string): SeenBackgroundWork {
  const seen = seenByChat.get(scopeKey)
  if (seen === undefined) {
    return emptySeenBackgroundWork(scopeKey)
  }
  // Map order is recency: re-inserting moves this chat to the newest end.
  seenByChat.delete(scopeKey)
  seenByChat.set(scopeKey, seen)
  return seen
}

export function writeSeenBackgroundWork(seen: SeenBackgroundWork): void {
  seenByChat.delete(seen.scopeKey)
  seenByChat.set(seen.scopeKey, seen)
  for (const scopeKey of seenByChat.keys()) {
    if (seenByChat.size <= MAX_SEEN_BACKGROUND_CHATS) {
      break
    }
    seenByChat.delete(scopeKey)
  }
}

/** Empties the store, for tests that must not see another test's chats. */
export function resetSeenBackgroundWorkStoreForTests(): void {
  seenByChat.clear()
}
