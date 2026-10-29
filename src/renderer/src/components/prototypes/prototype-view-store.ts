import { create } from 'zustand'
import type { PrototypeFilter } from '../../../../shared/prototype-list-model'
import {
  createSetState,
  keepListedLetters,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'

// The Prototypes screen state, in memory for the session: the agent filter, the selected set or design
// system, each set's screen state, and each design system's view state. Nothing here is saved; a restart
// starts every set and design system over.
// Invariants (tested in prototype-view-store.test.ts): a set's state is created once, a later ensure
// keeps it and moves only a letter the set no longer has, an update changes only the request it names,
// and an update never creates a state. Selecting a set clears the design system selection and the
// other way round.
type PrototypeViewStore = {
  filter: PrototypeFilter
  selectedRequestId: string | null
  /** The project whose design system is selected instead of a set; null when none is. */
  selectedProjectKey: string | null
  states: Readonly<Record<string, PrototypeSetState>>
  designSystemViews: Readonly<Record<string, DesignSystemViewState>>
  setFilter: (filter: PrototypeFilter) => void
  selectRequest: (requestId: string | null) => void
  selectDesignSystem: (projectKey: string) => void
  ensureSetState: (requestId: string, letters: readonly string[]) => void
  updateSetState: (
    requestId: string,
    update: (state: PrototypeSetState) => PrototypeSetState
  ) => void
  updateDesignSystemView: (
    projectKey: string,
    update: (state: DesignSystemViewState) => DesignSystemViewState
  ) => void
}

export const usePrototypeViewStore = create<PrototypeViewStore>()((set) => ({
  filter: 'all',
  selectedRequestId: null,
  selectedProjectKey: null,
  states: {},
  designSystemViews: {},
  setFilter: (filter) => set({ filter }),
  selectRequest: (selectedRequestId) => set({ selectedRequestId, selectedProjectKey: null }),
  selectDesignSystem: (selectedProjectKey) => set({ selectedProjectKey, selectedRequestId: null }),
  ensureSetState: (requestId, letters) =>
    set((current) => {
      const existing = current.states[requestId]
      if (existing === undefined) {
        return { states: { ...current.states, [requestId]: createSetState(letters) } }
      }
      const kept = keepListedLetters(existing, letters)
      return kept === existing ? current : { states: { ...current.states, [requestId]: kept } }
    }),
  updateSetState: (requestId, update) =>
    set((current) => {
      const existing = current.states[requestId]
      if (existing === undefined) {
        return current
      }
      return { states: { ...current.states, [requestId]: update(existing) } }
    }),
  updateDesignSystemView: (projectKey, update) =>
    set((current) => ({
      designSystemViews: {
        ...current.designSystemViews,
        [projectKey]: update(current.designSystemViews[projectKey] ?? emptyDesignSystemViewState())
      }
    }))
}))
