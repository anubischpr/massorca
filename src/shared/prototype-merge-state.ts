import {
  isPlanForRequest,
  keptMergeParts,
  reviewPartsOf,
  type PrototypeMergePlan,
  type PrototypeMergeReviewPart
} from './prototype-merge-plan'
import { dropUntouchedPins, type PrototypeSetState } from './prototype-set-state'

// The merge of starred directions, as transitions of a set's state: the suggestion request, the
// plan under review, the send, and the merged direction joining the set as the main. Stars and the
// merge ending when the user navigates away live in prototype-set-state.ts.

/**
 * Merge needs two stars, no merge under way, and a letter free for the result. A merge already sent
 * does not hold the next one: if its direction never shows up, the user can ask again.
 */
export function canMerge(state: PrototypeSetState, nextLetter: string | null): boolean {
  return state.starred.length >= 2 && state.merge === null && nextLetter !== null
}

/**
 * A merge starts on the click, so its progress row shows at once. The plan file's text is read next,
 * and `setMergeBaseline` then sends the suggestion request; the main area is blank until the plan arrives.
 */
export function beginMerge(
  state: PrototypeSetState,
  request: { planId: string; baseline?: string | null }
): PrototypeSetState {
  if (state.starred.length < 2 || state.merge !== null) {
    return state
  }
  return {
    ...state,
    layout: 'focus',
    merge: {
      phase: 'waiting',
      letters: state.starred,
      planId: request.planId,
      baseline: request.baseline,
      layoutBefore: state.layout
    },
    mergeSendFailed: false,
    sentMessage: null
  }
}

/** The plan file's text was read for a waiting merge: the request goes out after this, with that text. */
export function setMergeBaseline(
  state: PrototypeSetState,
  planId: string,
  baseline: string | null
): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'waiting' || merge.planId !== planId || merge.baseline !== undefined) {
    return state
  }
  return { ...state, merge: { ...merge, baseline } }
}

/** The chat refused the suggestion request: the merge does not start, the stars stay. */
export function mergeRequestRefused(state: PrototypeSetState): PrototypeSetState {
  return state.merge?.phase === 'waiting' ? { ...state, merge: null, mergeSendFailed: true } : state
}

/** The plan file's text, read while waiting; it opens the review when it answers this request. */
export function planArrived(
  state: PrototypeSetState,
  plan: PrototypeMergePlan,
  text: string
): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'waiting' || !isPlanForRequest(plan, text, merge)) {
    return state
  }
  return {
    ...state,
    merge: {
      phase: 'review',
      letters: merge.letters,
      parts: reviewPartsOf(plan),
      note: '',
      sending: false,
      layoutBefore: merge.layoutBefore
    }
  }
}

function withParts(
  state: PrototypeSetState,
  change: (parts: readonly PrototypeMergeReviewPart[]) => readonly PrototypeMergeReviewPart[]
): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'review') {
    return state
  }
  return { ...state, merge: { ...merge, parts: change(merge.parts) }, mergeSendFailed: false }
}

/** The checkbox of a part: leave it out, or take it back in. */
export function togglePart(state: PrototypeSetState, index: number): PrototypeSetState {
  return withParts(state, (parts) =>
    parts.map((part, at) => (at === index ? { ...part, on: !part.on } : part))
  )
}

/** The segmented source of a part; only a starred letter the part has is a source. */
export function setPartSource(
  state: PrototypeSetState,
  index: number,
  letter: string
): PrototypeSetState {
  const { merge } = state
  if (
    merge?.phase !== 'review' ||
    !merge.letters.includes(letter) ||
    merge.parts[index]?.selectors[letter] === undefined
  ) {
    return state
  }
  return withParts(state, (parts) =>
    parts.map((part, at) => (at === index ? { ...part, from: letter } : part))
  )
}

export function setMergeNote(state: PrototypeSetState, text: string): PrototypeSetState {
  const { merge } = state
  return merge?.phase === 'review' ? { ...state, merge: { ...merge, note: text } } : state
}

/** The review's Cancel: the stars stay, the merge ends. */
export function cancelMerge(state: PrototypeSetState): PrototypeSetState {
  return state.merge === null ? state : { ...state, merge: null, mergeSendFailed: false }
}

/**
 * A Layout toggle (View all or Design main) only changes the layout: a merge under way and a sent one
 * stay. The transitions of prototype-set-state.ts still end a merge that they leave.
 */
export function withMergeKept(
  state: PrototypeSetState,
  change: (current: PrototypeSetState) => PrototypeSetState
): PrototypeSetState {
  const changed = change(state)
  return { ...changed, merge: state.merge, mergeSendFailed: state.mergeSendFailed }
}

/** "Merge into D" needs at least one part kept, and no send in flight. */
export function canSendMerge(state: PrototypeSetState): boolean {
  const { merge } = state
  return merge?.phase === 'review' && !merge.sending && keptMergeParts(merge.parts).length > 0
}

export function beginMergeSend(state: PrototypeSetState): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'review' || merge.sending) {
    return state
  }
  return { ...state, merge: { ...merge, sending: true }, mergeSendFailed: false }
}

/** The chat took "Merge into D": the review closes and the set waits for D. */
export function mergeSent(
  state: PrototypeSetState,
  sent: { letter: string; visibleMessage: string }
): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'review') {
    return state
  }
  return {
    ...state,
    layout: merge.layoutBefore ?? state.layout,
    merge: null,
    mergeInto: { letter: sent.letter, from: merge.letters },
    mergeSendFailed: false,
    sendFailed: false,
    sentMessage: sent.visibleMessage
  }
}

/** The progress row's Cancel for a sent merge: the wait for its direction ends, and the chat keeps its work. */
export function cancelSentMerge(state: PrototypeSetState): PrototypeSetState {
  return state.mergeInto === null ? state : { ...state, mergeInto: null }
}

/** Whether the chat took a merge message. A send that throws is a refusal, like one the chat declines. */
export async function chatTookMerge(send: () => Promise<boolean>): Promise<boolean> {
  try {
    return await send()
  } catch {
    return false
  }
}

/** The chat refused "Merge into D": the review stays as it was, with the send-failure line. */
export function mergeRefused(state: PrototypeSetState): PrototypeSetState {
  const { merge } = state
  if (merge?.phase !== 'review') {
    return state
  }
  return { ...state, merge: { ...merge, sending: false }, mergeSendFailed: true }
}

/**
 * The merged direction shows up in the set: it becomes the main and the one on screen, the stars
 * clear, and it keeps which directions it was merged from. Until then the state is unchanged.
 */
export function adoptMergedDirection(
  state: PrototypeSetState,
  listedLetters: readonly string[]
): PrototypeSetState {
  const { mergeInto } = state
  if (mergeInto === null || !listedLetters.includes(mergeInto.letter)) {
    return state
  }
  return {
    ...dropUntouchedPins(state),
    layout: 'focus',
    active: mergeInto.letter,
    view: mergeInto.letter,
    selectedPinKey: null,
    picker: null,
    starred: [],
    mergeInto: null,
    mergedFrom: { ...state.mergedFrom, [mergeInto.letter]: mergeInto.from }
  }
}
