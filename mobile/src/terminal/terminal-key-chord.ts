import { buildTerminalShortcutKey, type TerminalShortcutModifier } from './terminal-accessory-keys'

export type TerminalKeyChordModifier = TerminalShortcutModifier

export type TerminalKeyChordKeyId =
  | 'escape'
  | 'tab'
  | 'enter'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight'
  | 'c'
  | 'd'
  | 'z'
  | 'l'

const MODIFIER_LABELS: Record<TerminalKeyChordModifier, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt'
}

const KEY_LABELS: Record<TerminalKeyChordKeyId, string> = {
  escape: 'Esc',
  tab: 'Tab',
  enter: 'Enter',
  arrowUp: '↑',
  arrowDown: '↓',
  arrowLeft: '←',
  arrowRight: '→',
  c: 'C',
  d: 'D',
  z: 'Z',
  l: 'L'
}

/** Modifiers in the order the Keys row lists them. */
export const TERMINAL_KEY_CHORD_MODIFIERS = (['ctrl', 'shift', 'alt'] as const).map((id) => ({
  id,
  label: MODIFIER_LABELS[id]
}))

/** Built-in main keys in the order the Keys row lists them. */
export const TERMINAL_KEY_CHORD_KEYS = (
  [
    'escape',
    'tab',
    'enter',
    'arrowUp',
    'arrowDown',
    'arrowLeft',
    'arrowRight',
    'c',
    'd',
    'z',
    'l'
  ] as const
).map((id) => ({ id, label: KEY_LABELS[id] }))

export function terminalKeyChordModifierLabel(modifier: TerminalKeyChordModifier): string {
  return MODIFIER_LABELS[modifier]
}

export function terminalKeyChordKeyLabel(keyId: TerminalKeyChordKeyId): string {
  return KEY_LABELS[keyId]
}

/**
 * The bytes a chord sends, from the encoder the accessory keys and saved shortcuts already use.
 * Modifier order does not change them; the xterm rules pick the form.
 */
export function buildTerminalKeyChordBytes(
  modifiers: readonly TerminalKeyChordModifier[],
  keyId: TerminalKeyChordKeyId
): string | null {
  return buildTerminalShortcutKey({ key: keyId, modifiers: [...modifiers] })?.bytes ?? null
}

/** The label the chord bar shows, such as "Ctrl + Shift + Tab". */
export function formatTerminalKeyChordLabel(parts: readonly string[]): string {
  return parts.join(' + ')
}
