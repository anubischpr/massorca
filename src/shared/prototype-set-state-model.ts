import type { NativeChatVisualRect } from './native-chat-visual-annotate'
import type { PrototypeDraftField, PrototypeNotes, PrototypePin } from './prototype-draft'
import type { PrototypeMergeInto, PrototypeMergeState } from './prototype-merge-plan'

// The shape of a set's screen state, how a fresh one starts, and how its pins are named and found.
// The transitions are in prototype-set-state.ts.

export type PrototypeLayout = 'set' | 'focus'
export type PrototypeViewport = 'desktop' | 'phone'
export type PrototypeTool = 'browse' | 'annotate'
export type PrototypePicker = 'color' | 'bg'

export type PrototypeSetState = {
  layout: PrototypeLayout
  viewport: PrototypeViewport
  tool: PrototypeTool
  /** The main direction: the one edits and notes go on, and a message goes back about. */
  active: string
  /** The direction on screen; a letter other than `active` is read-only. */
  view: string
  selectedPinKey: string | null
  picker: PrototypePicker | null
  hue: number
  /** Pins by the letter of the direction whose file they sit on. */
  pins: Readonly<Record<string, readonly PrototypeSetPin[]>>
  /** Keyed `${letter}:${pinKey}`, as buildDraft reads them. */
  notes: PrototypeNotes
  prompt: string
  /** The draft item last jumped to: its control pulses once per nonce. */
  pulse: { field: PrototypeDraftField; nonce: number } | null
  sending: boolean
  sendFailed: boolean
  /** The message the last successful send carried, shown until the next change. */
  sentMessage: string | null
  /** The letters starred for a merge, in letter order. Any direction can be starred. */
  starred: readonly string[]
  merge: PrototypeMergeState | null
  /** The merged direction a send asked for; it becomes the main when the set lists it. */
  mergeInto: PrototypeMergeInto | null
  /** The directions a merged one was built from, by the merged direction's letter. */
  mergedFrom: Readonly<Record<string, readonly string[]>>
  /** The chat refused the last merge message. */
  mergeSendFailed: boolean
}

export const DEFAULT_PICKER_HUE = 210

/** A pin with the frame rectangle and viewport it was picked at, for its screenshot at send. */
export type PrototypeSetPin = PrototypePin & {
  rect: NativeChatVisualRect
  viewport: PrototypeViewport
}

export function createSetState(letters: readonly string[]): PrototypeSetState {
  const first = letters[0] ?? 'A'
  return {
    layout: 'focus',
    viewport: 'desktop',
    tool: 'annotate',
    active: first,
    view: first,
    selectedPinKey: null,
    picker: null,
    hue: DEFAULT_PICKER_HUE,
    pins: {},
    notes: {},
    prompt: '',
    pulse: null,
    sending: false,
    sendFailed: false,
    sentMessage: null,
    starred: [],
    merge: null,
    mergeInto: null,
    mergedFrom: {},
    mergeSendFailed: false
  }
}

/** A pin's key is its selector's hash: the same element on two directions has the same key. */
export function pinKeyFor(selector: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < selector.length; index += 1) {
    hash ^= selector.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `pin-${(hash >>> 0).toString(16)}`
}

export function pinsOf(state: PrototypeSetState, letter: string): readonly PrototypeSetPin[] {
  return state.pins[letter] ?? []
}

export function selectedPinOf(state: PrototypeSetState): PrototypeSetPin | null {
  if (state.selectedPinKey === null) {
    return null
  }
  return pinsOf(state, state.view).find((pin) => pin.pinKey === state.selectedPinKey) ?? null
}
