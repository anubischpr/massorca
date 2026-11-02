import type { StateCreator } from 'zustand'
import type { AppState } from '../types'

/** In-progress "Send Feedback" report. Session-only (never `persist`-wrapped,
 *  no disk surface): the dialog renders inside the sidebar subtree, which
 *  unmounts whenever the sidebar collapses, and a failed submit is precisely
 *  when the user still needs what they typed (orca#22466). Cleared on a
 *  confirmed delivery or app restart. */
export type FeedbackDraft = {
  feedback: string
}

export type FeedbackDraftSlice = {
  feedbackDraft: FeedbackDraft
  /** Shallow-merge the patch into the current draft. */
  setFeedbackDraft: (patch: Partial<FeedbackDraft>) => void
  clearFeedbackDraft: () => void
}

// Why a shared constant is safe here (unlike newIssueDraft's factory): every
// field is a primitive, so no caller can mutate one draft into another's state.
const EMPTY_FEEDBACK_DRAFT: FeedbackDraft = { feedback: '' }

export const createFeedbackDraftSlice: StateCreator<AppState, [], [], FeedbackDraftSlice> = (
  set
) => ({
  feedbackDraft: EMPTY_FEEDBACK_DRAFT,
  setFeedbackDraft: (patch) =>
    set((state) => ({ feedbackDraft: { ...state.feedbackDraft, ...patch } })),
  clearFeedbackDraft: () => set({ feedbackDraft: EMPTY_FEEDBACK_DRAFT })
})
