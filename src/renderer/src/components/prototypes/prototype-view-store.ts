import { create } from 'zustand'
import type { PrototypeFilter } from '../../../../shared/prototype-list-model'
import { adoptMergedDirection } from '../../../../shared/prototype-merge-state'
import {
  createSetState,
  keepListedLetters,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'

/** Why: the floating checklist follows the chat that generated the set in view. */
export type PrototypeFocusedSetSessions = { sessionId: string; originSessionId: string | null }

// In memory only: a restart starts over. A later ensure keeps a set's draft; an update never creates a state.
type PrototypeViewStore = {
  filter: PrototypeFilter
  selectedRequestId: string | null
  /** The project whose design system is selected instead of a set; null when none is. */
  selectedProjectKey: string | null
  states: Readonly<Record<string, PrototypeSetState>>
  designSystemViews: Readonly<Record<string, DesignSystemViewState>>
  /** The side panel is hidden; hiding it changes no set state, so every draft stays. */
  sidePanelHidden: boolean
  /** The list is hidden during a merge; the page clears it once no merge is under way. */
  listPanelHidden: boolean
  /** The chats behind the set in view, published while the page is shown; null otherwise. */
  focusedSetSessions: PrototypeFocusedSetSessions | null
  setFocusedSetSessions: (sessions: PrototypeFocusedSetSessions | null) => void
  setFilter: (filter: PrototypeFilter) => void
  setSidePanelHidden: (hidden: boolean) => void
  setListPanelHidden: (hidden: boolean) => void
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
  sidePanelHidden: false,
  listPanelHidden: false,
  focusedSetSessions: null,
  setFocusedSetSessions: (focusedSetSessions) =>
    set((current) => {
      const previous = current.focusedSetSessions
      return previous?.sessionId === focusedSetSessions?.sessionId &&
        previous?.originSessionId === focusedSetSessions?.originSessionId
        ? current
        : { focusedSetSessions }
    }),
  setFilter: (filter) => set({ filter }),
  setSidePanelHidden: (sidePanelHidden) => set({ sidePanelHidden }),
  setListPanelHidden: (listPanelHidden) => set({ listPanelHidden }),
  selectRequest: (selectedRequestId) => set({ selectedRequestId, selectedProjectKey: null }),
  selectDesignSystem: (selectedProjectKey) => set({ selectedProjectKey, selectedRequestId: null }),
  ensureSetState: (requestId, letters) =>
    set((current) => {
      const existing = current.states[requestId]
      if (existing === undefined) {
        return { states: { ...current.states, [requestId]: createSetState(letters) } }
      }
      // A merged direction the set now lists becomes the main.
      const kept = adoptMergedDirection(keepListedLetters(existing, letters), letters)
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
