import type { RpcResponse } from '../transport/types'
import { isMethodNotFoundRefusal } from '../transport/rpc-acceptance-policies'

export type TerminalUpdateViewportCapability = 'unknown' | 'supported' | 'unsupported'

export type TerminalViewportRefitTargetState = {
  activeHandle: string | null
  expectedHandle: string
  currentRef: unknown
  expectedRef: unknown
  nativeChatCovered: boolean
  disposed: boolean
  runSeq: number
  currentRunSeq: number
}

/** What the runtime did with the viewport: recorded it, and whether it re-fitted the PTY too. */
export type TerminalViewportUpdateOutcome = { updated: boolean; applied: boolean }

export function resolveTerminalUpdateViewportCapability(
  response: RpcResponse
): TerminalUpdateViewportCapability {
  if (response.ok) {
    return 'supported'
  }
  return isMethodNotFoundRefusal(response) ? 'unsupported' : 'unknown'
}

// Why: defer height refits while typing, then coalesce every skipped layout
// change into one correction after the keyboard closes. A keyboard that resizes
// the frame (the Terminal panel's phone mode) is the intended refit, so it is
// not deferred; the debounce still coalesces the layout churn around it.
export type TerminalFrameHeightRefitState = {
  frameHeight: number
  keyboardVisible: boolean
  pending: boolean
  keyboardResizesFrame: boolean
}

export type TerminalFrameHeightRefitEvent =
  | { type: 'frame-height'; height: number }
  | { type: 'keyboard-visibility'; visible: boolean }
  | { type: 'keyboard-resizes-frame'; resizes: boolean }
  | { type: 'refit-committed' }

function defersForKeyboard(state: TerminalFrameHeightRefitState): boolean {
  return state.keyboardVisible && !state.keyboardResizesFrame
}

export function reduceTerminalFrameHeightRefit(
  state: TerminalFrameHeightRefitState,
  event: TerminalFrameHeightRefitEvent
): { state: TerminalFrameHeightRefitState; shouldRefit: boolean } {
  if (event.type === 'keyboard-resizes-frame') {
    const next = { ...state, keyboardResizesFrame: event.resizes }
    // Why: a change deferred before the keyboard began resizing the frame is owed now.
    if (event.resizes && state.pending && state.keyboardVisible) {
      return { state: { ...next, pending: false }, shouldRefit: true }
    }
    return { state: next, shouldRefit: false }
  }

  if (event.type === 'refit-committed') {
    // Why: the debounced height refit is firing. The keyboard can reopen during
    // the debounce window, so re-check here and re-defer rather than reflow the
    // PTY mid-keystroke; it runs on the next keyboard close.
    if (defersForKeyboard(state)) {
      return { state: { ...state, pending: true }, shouldRefit: false }
    }
    return { state: { ...state, pending: false }, shouldRefit: true }
  }

  if (event.type === 'keyboard-visibility') {
    if (event.visible === state.keyboardVisible) {
      return { state, shouldRefit: false }
    }
    if (event.visible) {
      return { state: { ...state, keyboardVisible: true }, shouldRefit: false }
    }
    return {
      state: { ...state, keyboardVisible: false, pending: false },
      shouldRefit: state.pending
    }
  }

  if (event.height === state.frameHeight) {
    return { state, shouldRefit: false }
  }
  if (defersForKeyboard(state)) {
    return {
      state: { ...state, frameHeight: event.height, pending: true },
      shouldRefit: false
    }
  }
  return {
    state: { ...state, frameHeight: event.height, pending: false },
    shouldRefit: true
  }
}

export function isTerminalViewportRefitTargetCurrent(
  state: TerminalViewportRefitTargetState
): boolean {
  return (
    !state.nativeChatCovered &&
    !state.disposed &&
    state.runSeq === state.currentRunSeq &&
    state.activeHandle === state.expectedHandle &&
    state.currentRef === state.expectedRef
  )
}

/** Whether a fitted grid needs a PTY resize: a forced refit always does, else only a new cols or rows. */
export function isViewportRefitNeeded(
  previous: { readonly cols: number; readonly rows: number } | null,
  next: { readonly cols: number; readonly rows: number },
  forced: boolean
): boolean {
  return forced || previous === null || previous.cols !== next.cols || previous.rows !== next.rows
}
