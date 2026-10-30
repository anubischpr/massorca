import { create } from 'zustand'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import type { PrototypeFilter } from '../../../src/shared/prototype-list-model'
import { adoptMergedDirection } from '../../../src/shared/prototype-merge-state'
import {
  createSetState,
  keepListedLetters,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import type { MobilePrototypeScope } from './mobile-prototype-list-model'

// The Prototypes screens' state, in memory for the session: the list's scope and filter, and each
// set's screen state. Nothing here is saved; a restart starts every set over.

/** A set's state key: request ids are only unique within one host. */
export function mobilePrototypeStateKey(hostId: string, requestId: string): string {
  return `${hostId}\0${requestId}`
}

/** A design system's state key: project keys are only unique within one host. */
export function mobilePrototypeDesignSystemKey(hostId: string, projectKey: string): string {
  return `${hostId}\0${projectKey}`
}

/** A new set opens on the phone viewport, as the phone screens do. */
export function createMobileSetState(letters: readonly string[]): PrototypeSetState {
  return { ...createSetState(letters), viewport: 'phone' }
}

type MobilePrototypeViewStore = {
  scope: MobilePrototypeScope
  filter: PrototypeFilter
  states: Readonly<Record<string, PrototypeSetState>>
  /** Each project's design system screen: its tab, selection and draft, kept while the app runs. */
  designSystemViews: Readonly<Record<string, DesignSystemViewState>>
  setScope: (scope: MobilePrototypeScope) => void
  setFilter: (filter: PrototypeFilter) => void
  ensureSetState: (key: string, letters: readonly string[]) => void
  updateSetState: (key: string, update: (state: PrototypeSetState) => PrototypeSetState) => void
  updateDesignSystemView: (
    key: string,
    update: (state: DesignSystemViewState) => DesignSystemViewState
  ) => void
}

export const useMobilePrototypeViewStore = create<MobilePrototypeViewStore>()((set) => ({
  scope: 'all',
  filter: 'all',
  states: {},
  designSystemViews: {},
  setScope: (scope) => set({ scope }),
  setFilter: (filter) => set({ filter }),
  ensureSetState: (key, letters) =>
    set((current) => {
      const existing = current.states[key]
      if (existing === undefined) {
        return { states: { ...current.states, [key]: createMobileSetState(letters) } }
      }
      // A merged direction the set now lists becomes the main.
      const kept = adoptMergedDirection(keepListedLetters(existing, letters), letters)
      return kept === existing ? current : { states: { ...current.states, [key]: kept } }
    }),
  updateSetState: (key, update) =>
    set((current) => {
      const existing = current.states[key]
      return existing === undefined
        ? current
        : { states: { ...current.states, [key]: update(existing) } }
    }),
  updateDesignSystemView: (key, update) =>
    set((current) => ({
      designSystemViews: {
        ...current.designSystemViews,
        [key]: update(current.designSystemViews[key] ?? emptyDesignSystemViewState())
      }
    }))
}))
