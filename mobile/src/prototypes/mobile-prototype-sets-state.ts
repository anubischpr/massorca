import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import type { MobilePrototypeSets } from '../session/mobile-prototype-host-rpc'

export type MobilePrototypeSetsState = {
  status: 'loading' | 'ready' | 'unsupported-host' | 'unreachable'
  sets: readonly PrototypeListedSet[]
  /** One per project that has a design system; empty from a host that predates them. */
  designSystems: readonly PrototypeListedDesignSystem[]
}

export const LOADING_PROTOTYPE_SETS: MobilePrototypeSetsState = {
  status: 'loading',
  sets: [],
  designSystems: []
}

/** A failed read keeps the sets already shown: losing contact is not an empty list. */
export function nextMobilePrototypeSetsState(
  previous: MobilePrototypeSetsState,
  result: MobilePrototypeSets
): MobilePrototypeSetsState {
  return result.kind === 'ready'
    ? { status: 'ready', sets: result.sets, designSystems: result.designSystems ?? [] }
    : { status: result.kind, sets: previous.sets, designSystems: previous.designSystems }
}

/** The set a screen was opened for, in the latest listing. */
export function findMobilePrototypeSet(
  state: MobilePrototypeSetsState,
  requestId: string
): PrototypeListedSet | null {
  return state.sets.find((set) => set.requestId === requestId) ?? null
}

/** The design system a screen was opened for, in the latest listing. */
export function findMobilePrototypeDesignSystem(
  state: MobilePrototypeSetsState,
  projectKey: string
): PrototypeListedDesignSystem | null {
  return state.designSystems.find((system) => system.projectKey === projectKey) ?? null
}
