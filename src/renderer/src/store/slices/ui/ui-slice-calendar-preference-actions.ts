import type { UISlice, UISliceSet } from './ui-slice-contract'

/** Calendar view preferences; the setter persists immediately, as the Agents view preferences do. */
export function createCalendarViewPreferenceActions(set: UISliceSet): Partial<UISlice> {
  return {
    calendarShowDoneRuns: false,
    setCalendarShowDoneRuns: (v) => {
      set({ calendarShowDoneRuns: v })
      window.api.ui.set({ calendarShowDoneRuns: v }).catch(console.error)
    }
  }
}
