import { create } from 'zustand'
import type { PrototypeFilter } from '../../../src/shared/prototype-list-model'
import { createSetState, type PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { MobilePrototypeScope } from './mobile-prototype-list-model'

// The Prototypes screens' state, in memory for the session: the list's scope and filter, and each
// set's screen state. Nothing here is saved; a restart starts every set over.

/** A set's state key: request ids are only unique within one host. */
export function mobilePrototypeStateKey(hostId: string, requestId: string): string {
  return `${hostId}\0${requestId}`
}

/** A new set opens on the phone viewport, as the phone screens do. */
export function createMobileSetState(letters: readonly string[]): PrototypeSetState {
  return { ...createSetState(letters), viewport: 'phone' }
}

type MobilePrototypeViewStore = {
  scope: MobilePrototypeScope
  filter: PrototypeFilter
  states: Readonly<Record<string, PrototypeSetState>>
  setScope: (scope: MobilePrototypeScope) => void
  setFilter: (filter: PrototypeFilter) => void
  ensureSetState: (key: string, letters: readonly string[]) => void
  updateSetState: (key: string, update: (state: PrototypeSetState) => PrototypeSetState) => void
}

export const useMobilePrototypeViewStore = create<MobilePrototypeViewStore>()((set) => ({
  scope: 'all',
  filter: 'all',
  states: {},
  setScope: (scope) => set({ scope }),
  setFilter: (filter) => set({ filter }),
  ensureSetState: (key, letters) =>
    set((current) =>
      current.states[key] === undefined
        ? { states: { ...current.states, [key]: createMobileSetState(letters) } }
        : current
    ),
  updateSetState: (key, update) =>
    set((current) => {
      const existing = current.states[key]
      return existing === undefined
        ? current
        : { states: { ...current.states, [key]: update(existing) } }
    })
}))
