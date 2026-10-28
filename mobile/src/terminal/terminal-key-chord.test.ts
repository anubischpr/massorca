import { describe, expect, it } from 'vitest'
import {
  buildTerminalKeyChordBytes,
  formatTerminalKeyChordLabel,
  type TerminalKeyChordKeyId,
  type TerminalKeyChordModifier
} from './terminal-key-chord'

function chordBytes(modifiers: TerminalKeyChordModifier[], keyId: TerminalKeyChordKeyId) {
  return buildTerminalKeyChordBytes(modifiers, keyId)
}

describe('buildTerminalKeyChordBytes', () => {
  it('sends control characters for Ctrl plus a letter', () => {
    expect(chordBytes(['ctrl'], 'c')).toBe('\x03')
    expect(chordBytes(['ctrl'], 'd')).toBe('\x04')
    expect(chordBytes(['ctrl'], 'z')).toBe('\x1a')
    expect(chordBytes(['ctrl'], 'l')).toBe('\x0c')
  })

  it('keeps the control character when Shift is also held', () => {
    expect(chordBytes(['ctrl', 'shift'], 'c')).toBe('\x03')
  })

  it('prefixes Alt with ESC', () => {
    expect(chordBytes(['alt'], 'c')).toBe('\x1bc')
    expect(chordBytes(['alt'], 'tab')).toBe('\x1b\t')
    expect(chordBytes(['alt'], 'enter')).toBe('\x1b\r')
    expect(chordBytes(['alt'], 'escape')).toBe('\x1b\x1b')
  })

  it('uppercases a letter for Shift', () => {
    expect(chordBytes(['shift'], 'c')).toBe('C')
  })

  it('sends Shift+Tab as reverse tab', () => {
    expect(chordBytes(['shift'], 'tab')).toBe('\x1b[Z')
  })

  it('keeps Shift in the modifier parameter when Ctrl or Alt joins Tab', () => {
    expect(chordBytes(['ctrl', 'shift'], 'tab')).toBe('\x1b[1;6Z')
    expect(chordBytes(['alt', 'shift'], 'tab')).toBe('\x1b[1;4Z')
  })

  it('sends the plain keys', () => {
    expect(chordBytes([], 'escape')).toBe('\x1b')
    expect(chordBytes([], 'tab')).toBe('\t')
    expect(chordBytes([], 'enter')).toBe('\r')
    expect(chordBytes([], 'arrowUp')).toBe('\x1b[A')
    expect(chordBytes([], 'arrowDown')).toBe('\x1b[B')
    expect(chordBytes([], 'arrowLeft')).toBe('\x1b[D')
    expect(chordBytes([], 'arrowRight')).toBe('\x1b[C')
  })

  it('encodes arrows with the xterm modifier parameter', () => {
    expect(chordBytes(['shift'], 'arrowUp')).toBe('\x1b[1;2A')
    expect(chordBytes(['alt'], 'arrowUp')).toBe('\x1b[1;3A')
    expect(chordBytes(['ctrl'], 'arrowRight')).toBe('\x1b[1;5C')
    expect(chordBytes(['ctrl', 'shift'], 'arrowLeft')).toBe('\x1b[1;6D')
    expect(chordBytes(['ctrl', 'alt', 'shift'], 'arrowDown')).toBe('\x1b[1;8B')
  })

  it('gives the same bytes whatever order the modifiers were tapped in', () => {
    expect(chordBytes(['shift', 'ctrl'], 'tab')).toBe(chordBytes(['ctrl', 'shift'], 'tab'))
  })
})

describe('formatTerminalKeyChordLabel', () => {
  it('joins the parts with spaced plus signs', () => {
    expect(formatTerminalKeyChordLabel(['Ctrl', 'Shift', 'Tab'])).toBe('Ctrl + Shift + Tab')
  })
})
