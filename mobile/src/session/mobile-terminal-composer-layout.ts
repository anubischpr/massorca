export type TerminalComposerLayoutInput = {
  /** The soft keyboard is up: the same signal the composer lifts on. */
  readonly keyboardUp: boolean
  /** The Keys toggle; it only applies while the keyboard is down. */
  readonly keysOpen: boolean
  /** A chord has a modifier or a main key chosen. */
  readonly chordBuilding: boolean
  /** The brief "Sent …" line is showing. */
  readonly chordSentShowing: boolean
}

export type TerminalComposerLayout = {
  /** The "TERMINALS · n" header and its New terminal button. */
  readonly showTerminalHeader: boolean
  readonly showKeysToggle: boolean
  readonly showKeyRow: boolean
  readonly showChordBar: boolean
}

/**
 * Which rows of the Terminal panel and its composer show. With the keyboard up the header and the
 * Keys toggle go, the key row stays inline, and the chord bar shows only while a chord is in play.
 */
export function resolveTerminalComposerLayout(
  input: TerminalComposerLayoutInput
): TerminalComposerLayout {
  const showKeyRow = input.keyboardUp || input.keysOpen
  return {
    showTerminalHeader: !input.keyboardUp,
    showKeysToggle: !input.keyboardUp,
    showKeyRow,
    showChordBar: showKeyRow && (!input.keyboardUp || input.chordBuilding || input.chordSentShowing)
  }
}

/**
 * How the soft keyboard meets the Terminal panel. Phone mode drives the PTY size, so the composer
 * stands on the keyboard and the terminal frame shrinks onto it. Desktop mode keeps the host's size
 * (the host records a phone viewport without applying it), so the composer overlays the grid.
 */
export type TerminalKeyboardFit = 'resize' | 'overlay'

export function resolveTerminalKeyboardFit(phoneMode: boolean): TerminalKeyboardFit {
  return phoneMode ? 'resize' : 'overlay'
}

/** Where the composer sits above the keyboard: a bottom margin shrinks the frame above it, a translate overlays it. */
export function resolveTerminalComposerOffset(
  fit: TerminalKeyboardFit,
  keyboardLift: number
): { readonly marginBottom: number; readonly translateY: number } {
  return fit === 'resize'
    ? { marginBottom: keyboardLift, translateY: 0 }
    : { marginBottom: 0, translateY: -keyboardLift }
}
