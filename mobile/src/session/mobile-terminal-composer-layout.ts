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
