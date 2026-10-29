import type {
  NativeChatVisualAnnotateState,
  NativeChatVisualOverride,
  NativeChatVisualStyleOverride
} from './native-chat-visual-annotate'
import {
  buildDraft,
  composeIterationMessage,
  type PrototypeDraft,
  type PrototypePin,
  type PrototypeSize
} from './prototype-draft'
import { neutralizePrototypeMarkers } from './prototype-hidden-instruction'
import { buildPrototypeIterationInstruction } from './prototype-request'
import type { PrototypeListedDirection } from './rpc-contract/prototype-params'
import { latestVersionOf } from './prototype-list-model'
import { pinsOf, type PrototypeSetState } from './prototype-set-state'

// What the screen derives from a set's state: its draft, the visible message, the live overrides and
// frame annotate state, and the text an iteration sends.

/** The draft of the iterated direction: edits and notes grouped by pin, then the sibling notes. */
export function draftOf(state: PrototypeSetState): PrototypeDraft {
  return buildDraft({
    activeLetter: state.active,
    pins: pinsOf(state, state.active),
    notes: state.notes
  })
}

/** Nothing to send: no change on any pin, and no words under "Anything else". */
export function hasNothingToSend(state: PrototypeSetState): boolean {
  return draftOf(state).itemCount === 0 && state.prompt.trim() === ''
}

/**
 * The one visible message: "Iterate on B.", the draft with any screenshot paths, then the prompt.
 * Neutralized as a whole, so no marker in user text is ever honored as a hidden instruction.
 */
export function visibleMessageOf(
  state: PrototypeSetState,
  screenshots: Readonly<Record<string, string>> = {}
): string {
  return neutralizePrototypeMarkers(
    composeIterationMessage({
      activeLetter: state.active,
      groups: draftOf(state).groups,
      pins: pinsOf(state, state.active),
      prompt: state.prompt,
      screenshots
    })
  )
}

function sameSize(left: PrototypeSize, right: PrototypeSize): boolean {
  return left.unit === right.unit && (left.unit === 'auto' || left.value === right.value)
}

/** The live overrides of one pin: only the fields that differ from the original. */
function overrideOf(pin: PrototypePin): NativeChatVisualOverride | null {
  const { original, current } = pin
  const style: NativeChatVisualStyleOverride = {}
  if (current.color !== original.color) {
    style.color = current.color
  }
  if (current.bg !== original.bg) {
    style.backgroundColor = current.bg
  }
  if (!sameSize(original.width, current.width)) {
    style.width = current.width
  }
  if (!sameSize(original.height, current.height)) {
    style.height = current.height
  }
  if (current.fontSize !== original.fontSize) {
    style.fontSize = current.fontSize
  }
  const hasStyle = Object.keys(style).length > 0
  const hasText = current.text !== original.text
  if (!hasStyle && !hasText) {
    return null
  }
  return {
    selector: pin.selector,
    ...(hasText ? { text: current.text } : {}),
    ...(hasStyle ? { style } : {})
  }
}

export function overridesOf(state: PrototypeSetState, letter: string): NativeChatVisualOverride[] {
  return pinsOf(state, letter).flatMap((pin) => {
    const override = overrideOf(pin)
    return override === null ? [] : [override]
  })
}

/** What the frame of one direction is told: the tool, its pins and their live overrides. */
export function annotateStateOf(
  state: PrototypeSetState,
  letter: string
): NativeChatVisualAnnotateState {
  return {
    enabled: state.tool === 'annotate',
    pins: pinsOf(state, letter).map((pin) => ({
      pinKey: pin.pinKey,
      number: pin.number,
      selector: pin.selector,
      active: letter === state.view && pin.pinKey === state.selectedPinKey
    })),
    overrides: overridesOf(state, letter)
  }
}

/** The version an iteration writes next: one past the newest of the iterated direction, from v2 on. */
export function nextVersionOf(
  directions: readonly PrototypeListedDirection[],
  letter: string
): number {
  const latest = latestVersionOf(directions.find((direction) => direction.letter === letter))
  return Math.max(2, (latest?.version ?? 1) + 1)
}

/**
 * The text an iteration sends: the visible message, then the hidden marker and the instruction that
 * names the next file. The chat shows only the visible part.
 */
export function iterationSendText({
  visibleMessage,
  requestId,
  letter,
  nextVersion,
  folderPath
}: {
  visibleMessage: string
  requestId: string
  letter: string
  nextVersion: number
  folderPath: string
}): string {
  const instruction = buildPrototypeIterationInstruction({
    requestId,
    letter,
    nextVersion,
    folderPath
  })
  return `${visibleMessage}\n\n${instruction}`
}

export function beginSend(state: PrototypeSetState): PrototypeSetState {
  return { ...state, sending: true, sendFailed: false, sentMessage: null }
}

/** After a successful send the set's draft is cleared; the sent card shows what went out. */
export function sendSucceeded(state: PrototypeSetState, sentMessage: string): PrototypeSetState {
  return {
    ...state,
    pins: {},
    notes: {},
    prompt: '',
    selectedPinKey: null,
    picker: null,
    pulse: null,
    sending: false,
    sendFailed: false,
    sentMessage
  }
}

/** A refused send keeps the draft exactly as it was. */
export function sendRefused(state: PrototypeSetState): PrototypeSetState {
  return { ...state, sending: false, sendFailed: true, sentMessage: null }
}
