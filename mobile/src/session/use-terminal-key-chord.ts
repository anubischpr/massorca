import { useCallback, useEffect, useState } from 'react'
import type { TerminalKeyChordModifier } from '../terminal/terminal-key-chord'
import {
  EMPTY_TERMINAL_KEY_CHORD,
  resolveTerminalKeyChord,
  selectTerminalKeyChordMainKey,
  toggleTerminalKeyChordModifier,
  type TerminalKeyChordMainKey,
  type TerminalKeyChordState
} from '../terminal/terminal-key-chord-state'

/** How long the "Sent …" line stays after a chord is sent. */
export const TERMINAL_KEY_CHORD_SENT_MS = 1600

/** A chord and its sent line, kept with the terminal they were built on. */
type TerminalKeyChordHolder = {
  readonly handle: string | null
  readonly chord: TerminalKeyChordState
  readonly sentLabel: string | null
}

function emptyHolder(handle: string | null): TerminalKeyChordHolder {
  return { handle, chord: EMPTY_TERMINAL_KEY_CHORD, sentLabel: null }
}

/** The Keys chord for the active terminal: the taps, the send, and the brief "Sent …" line. */
export function useTerminalKeyChord(activeHandle: string | null) {
  const [held, setHeld] = useState<TerminalKeyChordHolder>(() => emptyHolder(activeHandle))
  // Why: a chord built on one terminal must not carry over to another, so a holder for another handle reads as empty.
  const current = held.handle === activeHandle ? held : emptyHolder(activeHandle)

  useEffect(() => {
    if (current.sentLabel === null) {
      return
    }
    const timer = setTimeout(() => {
      setHeld((previous) =>
        previous.sentLabel === null ? previous : { ...previous, sentLabel: null }
      )
    }, TERMINAL_KEY_CHORD_SENT_MS)
    return () => clearTimeout(timer)
  }, [current.sentLabel])

  const update = useCallback(
    (apply: (previous: TerminalKeyChordHolder) => TerminalKeyChordHolder) => {
      setHeld((previous) =>
        apply(previous.handle === activeHandle ? previous : emptyHolder(activeHandle))
      )
    },
    [activeHandle]
  )

  const toggleModifier = useCallback(
    (modifier: TerminalKeyChordModifier) => {
      update((previous) => ({
        ...previous,
        chord: toggleTerminalKeyChordModifier(previous.chord, modifier),
        sentLabel: null
      }))
    },
    [update]
  )

  const selectMainKey = useCallback(
    (mainKey: TerminalKeyChordMainKey) => {
      update((previous) => ({
        ...previous,
        chord: selectTerminalKeyChordMainKey(previous.chord, mainKey),
        sentLabel: null
      }))
    },
    [update]
  )

  const clear = useCallback(() => {
    update((previous) => ({ ...previous, chord: EMPTY_TERMINAL_KEY_CHORD, sentLabel: null }))
  }, [update])

  /** Returns the bytes to send, or null while the chord is not sendable. */
  const send = useCallback((): string | null => {
    const resolved = resolveTerminalKeyChord(current.chord)
    if (resolved === null) {
      return null
    }
    update((previous) => ({
      ...previous,
      chord: EMPTY_TERMINAL_KEY_CHORD,
      sentLabel: resolved.label
    }))
    return resolved.bytes
  }, [current.chord, update])

  return {
    chord: current.chord,
    sentLabel: current.sentLabel,
    toggleModifier,
    selectMainKey,
    clear,
    send
  }
}
