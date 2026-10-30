// The Prototypes list keeps archived sets out of its main groups and counts, and shows them in an Archived group.
import type { PrototypeListRow } from './prototype-list-model'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

/** The sets the main list and its counts show: every one not archived. */
export function activePrototypeSets(sets: readonly PrototypeListedSet[]): PrototypeListedSet[] {
  return sets.filter((set) => set.archived !== true)
}

/** The sets of the Archived group. */
export function archivedPrototypeSets(sets: readonly PrototypeListedSet[]): PrototypeListedSet[] {
  return sets.filter((set) => set.archived === true)
}

/**
 * The set to open when the open one is archived: the row after it in the list, else the one before, else
 * none. `rows` is the main list in display order and still holds the set being archived.
 */
export function requestToOpenAfterArchiving(
  rows: readonly Pick<PrototypeListRow, 'set'>[],
  archivedRequestId: string
): string | null {
  const at = rows.findIndex((row) => row.set.requestId === archivedRequestId)
  const neighbor = rows[at + 1] ?? rows[at - 1]
  return neighbor?.set.requestId ?? null
}
