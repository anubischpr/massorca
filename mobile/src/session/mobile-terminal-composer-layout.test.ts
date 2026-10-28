import { describe, expect, it } from 'vitest'
import {
  resolveTerminalComposerLayout,
  resolveTerminalComposerOffset,
  resolveTerminalKeyboardFit,
  type TerminalComposerLayoutInput
} from './mobile-terminal-composer-layout'

const KEYBOARD_DOWN: TerminalComposerLayoutInput = {
  keyboardUp: false,
  keysOpen: true,
  chordBuilding: false,
  chordSentShowing: false
}

describe('resolveTerminalComposerLayout', () => {
  it('shows the header, the Keys toggle, the key row and the chord bar with the keyboard down', () => {
    expect(resolveTerminalComposerLayout(KEYBOARD_DOWN)).toEqual({
      showTerminalHeader: true,
      showKeysToggle: true,
      showKeyRow: true,
      showChordBar: true
    })
  })

  it('hides the key row and chord bar with the keyboard down when Keys is collapsed', () => {
    expect(resolveTerminalComposerLayout({ ...KEYBOARD_DOWN, keysOpen: false })).toEqual({
      showTerminalHeader: true,
      showKeysToggle: true,
      showKeyRow: false,
      showChordBar: false
    })
  })

  it('condenses with the keyboard up: no header or toggle, the key row inline, no idle chord bar', () => {
    expect(resolveTerminalComposerLayout({ ...KEYBOARD_DOWN, keyboardUp: true })).toEqual({
      showTerminalHeader: false,
      showKeysToggle: false,
      showKeyRow: true,
      showChordBar: false
    })
  })

  it('keeps the key row with the keyboard up even when Keys is collapsed', () => {
    const layout = resolveTerminalComposerLayout({
      ...KEYBOARD_DOWN,
      keyboardUp: true,
      keysOpen: false
    })
    expect(layout.showKeyRow).toBe(true)
  })

  it('shows the chord bar with the keyboard up only while a chord is being built', () => {
    const layout = resolveTerminalComposerLayout({
      ...KEYBOARD_DOWN,
      keyboardUp: true,
      chordBuilding: true
    })
    expect(layout.showChordBar).toBe(true)
  })

  it('shows the chord bar with the keyboard up briefly after a send', () => {
    const layout = resolveTerminalComposerLayout({
      ...KEYBOARD_DOWN,
      keyboardUp: true,
      chordSentShowing: true
    })
    expect(layout.showChordBar).toBe(true)
  })

  it('restores the normal layout when the keyboard hides again', () => {
    const up = resolveTerminalComposerLayout({ ...KEYBOARD_DOWN, keyboardUp: true })
    const down = resolveTerminalComposerLayout({ ...KEYBOARD_DOWN, keyboardUp: false })
    expect(up.showTerminalHeader).toBe(false)
    expect(down).toEqual(resolveTerminalComposerLayout(KEYBOARD_DOWN))
  })
})

describe('resolveTerminalKeyboardFit', () => {
  it('resizes the terminal frame in phone mode, where the phone drives the PTY size', () => {
    expect(resolveTerminalKeyboardFit(true)).toBe('resize')
  })

  it('overlays in desktop mode, where the host keeps its size', () => {
    expect(resolveTerminalKeyboardFit(false)).toBe('overlay')
  })
})

describe('resolveTerminalComposerOffset', () => {
  it('stands the composer on the keyboard with a margin when the frame resizes', () => {
    expect(resolveTerminalComposerOffset('resize', 300)).toEqual({
      marginBottom: 300,
      translateY: 0
    })
  })

  it('overlays the composer with a translate in desktop mode', () => {
    expect(resolveTerminalComposerOffset('overlay', 300)).toEqual({
      marginBottom: 0,
      translateY: -300
    })
  })

  it('leaves the composer where it is with the keyboard down', () => {
    expect(resolveTerminalComposerOffset('resize', 0)).toEqual({ marginBottom: 0, translateY: 0 })
  })
})
