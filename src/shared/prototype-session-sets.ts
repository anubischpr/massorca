import type { PrototypeListedSet } from './rpc-contract/prototype-params'

/** The chats whose prototype sets belong to one session: the session itself and the children it delegated to. */
export type PrototypeSessionScope = {
  sessionId: string
  /** Delegated children the caller knows of; sets that recorded this session as their origin match without them. */
  childSessionIds?: readonly string[]
}

/**
 * The sets a session made itself or through its children, newest first, so a surface that reports on that
 * session (a parent's finish notice, a bot's Conference room post) can open them in Prototypes.
 */
export function prototypeSetsOfSession(
  sets: readonly PrototypeListedSet[],
  scope: PrototypeSessionScope
): PrototypeListedSet[] {
  const chats = new Set([scope.sessionId, ...(scope.childSessionIds ?? [])])
  return sets
    .filter(
      (set) =>
        chats.has(set.sessionId) ||
        (set.origin !== undefined && set.origin.sessionId === scope.sessionId)
    )
    // Not `toSorted`: mobile's Hermes lacks it; filter already returned a fresh array.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** A stable key for a scope, so hooks refetch when the session or its children change, not on every render. */
export function prototypeSessionScopeKey(scope: PrototypeSessionScope | null): string {
  return scope === null ? '' : [scope.sessionId, ...(scope.childSessionIds ?? [])].join(' ')
}
