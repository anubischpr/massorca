import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { MobilePrototypeSets } from '../session/mobile-prototype-host-rpc'

export type MobilePrototypeSetsState = {
  status: 'loading' | 'ready' | 'unsupported-host' | 'unreachable'
  sets: readonly PrototypeListedSet[]
}

export const LOADING_PROTOTYPE_SETS: MobilePrototypeSetsState = { status: 'loading', sets: [] }

/** A failed read keeps the sets already shown: losing contact is not an empty list. */
export function nextMobilePrototypeSetsState(
  previous: MobilePrototypeSetsState,
  result: MobilePrototypeSets
): MobilePrototypeSetsState {
  return result.kind === 'ready'
    ? { status: 'ready', sets: result.sets }
    : { status: result.kind, sets: previous.sets }
}

/** The set a screen was opened for, in the latest listing. */
export function findMobilePrototypeSet(
  state: MobilePrototypeSetsState,
  requestId: string
): PrototypeListedSet | null {
  return state.sets.find((set) => set.requestId === requestId) ?? null
}
