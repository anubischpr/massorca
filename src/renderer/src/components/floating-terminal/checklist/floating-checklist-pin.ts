import { create } from 'zustand'

// In memory only: the tab survives a restart, a hand-picked session does not.
type FloatingChecklistPinStore = {
  /** The session each Checklist tab is held on; absent while the tab follows focus. */
  pinnedSessionByTabId: Readonly<Record<string, string>>
  pin: (tabId: string, sessionId: string) => void
  followFocus: (tabId: string) => void
}

export const useFloatingChecklistPinStore = create<FloatingChecklistPinStore>()((set) => ({
  pinnedSessionByTabId: {},
  pin: (tabId, sessionId) =>
    set((current) => ({
      pinnedSessionByTabId: { ...current.pinnedSessionByTabId, [tabId]: sessionId }
    })),
  followFocus: (tabId) =>
    set((current) => {
      if (!(tabId in current.pinnedSessionByTabId)) {
        return current
      }
      const { [tabId]: _released, ...rest } = current.pinnedSessionByTabId
      return { pinnedSessionByTabId: rest }
    })
}))
