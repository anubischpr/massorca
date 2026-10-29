import { describe, expect, it } from 'vitest'
import {
  EMPTY_TERMINAL_KEY_CHORD,
  isTerminalKeyChordBuilding,
  resolveTerminalKeyChord,
  selectTerminalKeyChordMainKey,
  terminalKeyChordModifierOrder,
  terminalKeyChordParts,
  terminalKeyChordStatus,
  toggleTerminalKeyChordModifier,
  type TerminalKeyChordMainKey
} from './terminal-key-chord-state'

const TAB: TerminalKeyChordMainKey = { kind: 'key', id: 'tab' }
const C_KEY: TerminalKeyChordMainKey = { kind: 'key', id: 'c' }
const SAVED_SHORTCUT: TerminalKeyChordMainKey = {
  kind: 'shortcut',
  id: 'custom-retry',
  label: 'Ctrl+R',
  bytes: '\x12'
}

describe('terminal key chord state', () => {
  it('numbers the modifier badges in tap order and renumbers when one is removed', () => {
    let state = toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'shift')
    state = toggleTerminalKeyChordModifier(state, 'ctrl')
    expect(terminalKeyChordModifierOrder(state, 'shift')).toBe(1)
    expect(terminalKeyChordModifierOrder(state, 'ctrl')).toBe(2)
    expect(terminalKeyChordModifierOrder(state, 'alt')).toBeNull()

    state = toggleTerminalKeyChordModifier(state, 'shift')
    expect(terminalKeyChordModifierOrder(state, 'shift')).toBeNull()
    expect(terminalKeyChordModifierOrder(state, 'ctrl')).toBe(1)
  })

  it('keeps one main key: another key replaces it and the same key clears it', () => {
    let state = selectTerminalKeyChordMainKey(EMPTY_TERMINAL_KEY_CHORD, TAB)
    state = selectTerminalKeyChordMainKey(state, C_KEY)
    expect(state.mainKey).toEqual(C_KEY)

    state = selectTerminalKeyChordMainKey(state, C_KEY)
    expect(state.mainKey).toBeNull()
  })

  it('builds the label and bytes from the taps', () => {
    let state = toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'ctrl')
    state = selectTerminalKeyChordMainKey(state, C_KEY)
    expect(terminalKeyChordParts(state)).toEqual(['Ctrl', 'C'])
    expect(resolveTerminalKeyChord(state)).toEqual({ label: 'Ctrl + C', bytes: '\x03' })
    expect(terminalKeyChordStatus(state)).toBe('ready')
  })

  it('labels the chord in tap order but encodes the modifier set once', () => {
    let state = toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'shift')
    state = toggleTerminalKeyChordModifier(state, 'ctrl')
    state = selectTerminalKeyChordMainKey(state, TAB)
    expect(resolveTerminalKeyChord(state)).toEqual({
      label: 'Shift + Ctrl + Tab',
      bytes: '\x1b[1;6Z'
    })
  })

  it('reports idle, needs-key and blocked states without sending anything', () => {
    expect(terminalKeyChordStatus(EMPTY_TERMINAL_KEY_CHORD)).toBe('idle')
    expect(isTerminalKeyChordBuilding(EMPTY_TERMINAL_KEY_CHORD)).toBe(false)

    const modifiersOnly = toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'alt')
    expect(isTerminalKeyChordBuilding(modifiersOnly)).toBe(true)
    expect(terminalKeyChordStatus(modifiersOnly)).toBe('needs-key')
    expect(resolveTerminalKeyChord(modifiersOnly)).toBeNull()

    const blocked = selectTerminalKeyChordMainKey(
      toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'ctrl'),
      SAVED_SHORTCUT
    )
    expect(terminalKeyChordStatus(blocked)).toBe('blocked')
    expect(resolveTerminalKeyChord(blocked)).toBeNull()
  })

  it('sends a saved shortcut as its own bytes only when no modifier is held', () => {
    const alone = selectTerminalKeyChordMainKey(EMPTY_TERMINAL_KEY_CHORD, SAVED_SHORTCUT)
    expect(resolveTerminalKeyChord(alone)).toEqual({ label: 'Ctrl+R', bytes: '\x12' })
    expect(terminalKeyChordStatus(alone)).toBe('ready')
  })

  it('returns to idle when the chord is cleared back to empty', () => {
    const built = selectTerminalKeyChordMainKey(
      toggleTerminalKeyChordModifier(EMPTY_TERMINAL_KEY_CHORD, 'ctrl'),
      C_KEY
    )
    expect(terminalKeyChordStatus(built)).toBe('ready')
    expect(terminalKeyChordStatus(EMPTY_TERMINAL_KEY_CHORD)).toBe('idle')
  })
})
