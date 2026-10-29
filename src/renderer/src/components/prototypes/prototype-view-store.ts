import { create } from 'zustand'
import type { PrototypeFilter } from './prototype-list-model'
import { createSetState, type PrototypeSetState } from './prototype-set-state'

// The Prototypes screen state, in memory for the session: the agent filter, the selected set, and
// each set's screen state. Nothing here is saved; a restart starts every set over.
type PrototypeViewStore = {
  filter: PrototypeFilter
  selectedRequestId: string | null
  states: Readonly<Record<string, PrototypeSetState>>
  setFilter: (filter: PrototypeFilter) => void
  selectRequest: (requestId: string | null) => void
  ensureSetState: (requestId: string, letters: readonly string[]) => void
  updateSetState: (
    requestId: string,
    update: (state: PrototypeSetState) => PrototypeSetState
  ) => void
}

export const usePrototypeViewStore = create<PrototypeViewStore>()((set) => ({
  filter: 'all',
  selectedRequestId: null,
  states: {},
  setFilter: (filter) => set({ filter }),
  selectRequest: (selectedRequestId) => set({ selectedRequestId }),
  ensureSetState: (requestId, letters) =>
    set((current) =>
      current.states[requestId] === undefined
        ? { states: { ...current.states, [requestId]: createSetState(letters) } }
        : current
    ),
  updateSetState: (requestId, update) =>
    set((current) => {
      const existing = current.states[requestId]
      if (existing === undefined) {
        return current
      }
      return { states: { ...current.states, [requestId]: update(existing) } }
    })
}))
