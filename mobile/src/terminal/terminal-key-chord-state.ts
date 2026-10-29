import {
  buildTerminalKeyChordBytes,
  formatTerminalKeyChordLabel,
  terminalKeyChordKeyLabel,
  terminalKeyChordModifierLabel,
  type TerminalKeyChordKeyId,
  type TerminalKeyChordModifier
} from './terminal-key-chord'

/** A main key: a built-in key, or a saved custom shortcut whose bytes are already fixed. */
export type TerminalKeyChordMainKey =
  | { readonly kind: 'key'; readonly id: TerminalKeyChordKeyId }
  | {
      readonly kind: 'shortcut'
      readonly id: string
      readonly label: string
      readonly bytes: string
    }

export type TerminalKeyChordState = {
  /** In tap order: the Keys row numbers the modifier badges 1, 2, 3 in this order. */
  readonly modifiers: readonly TerminalKeyChordModifier[]
  readonly mainKey: TerminalKeyChordMainKey | null
}

/** idle: nothing chosen. needs-key: modifiers only. blocked: no bytes for this chord. ready: sendable. */
export type TerminalKeyChordStatus = 'idle' | 'needs-key' | 'blocked' | 'ready'

export type TerminalKeyChordSend = {
  readonly label: string
  readonly bytes: string
}

export const EMPTY_TERMINAL_KEY_CHORD: TerminalKeyChordState = { modifiers: [], mainKey: null }

export function toggleTerminalKeyChordModifier(
  state: TerminalKeyChordState,
  modifier: TerminalKeyChordModifier
): TerminalKeyChordState {
  const modifiers = state.modifiers.includes(modifier)
    ? state.modifiers.filter((selected) => selected !== modifier)
    : [...state.modifiers, modifier]
  return { modifiers, mainKey: state.mainKey }
}

/** Tapping the selected main key clears it; another key replaces it, so a chord has one at most. */
export function selectTerminalKeyChordMainKey(
  state: TerminalKeyChordState,
  mainKey: TerminalKeyChordMainKey
): TerminalKeyChordState {
  const isSelected = state.mainKey !== null && isSameMainKey(state.mainKey, mainKey)
  return { modifiers: state.modifiers, mainKey: isSelected ? null : mainKey }
}

/** The 1-based badge number of a selected modifier, or null when it is not selected. */
export function terminalKeyChordModifierOrder(
  state: TerminalKeyChordState,
  modifier: TerminalKeyChordModifier
): number | null {
  const index = state.modifiers.indexOf(modifier)
  return index === -1 ? null : index + 1
}

export function isTerminalKeyChordBuilding(state: TerminalKeyChordState): boolean {
  return state.modifiers.length > 0 || state.mainKey !== null
}

/** The chord bar's parts in tap order: the modifiers, then the main key. */
export function terminalKeyChordParts(state: TerminalKeyChordState): readonly string[] {
  const parts = state.modifiers.map((modifier) => terminalKeyChordModifierLabel(modifier))
  return state.mainKey === null ? parts : [...parts, mainKeyLabel(state.mainKey)]
}

export function terminalKeyChordStatus(state: TerminalKeyChordState): TerminalKeyChordStatus {
  if (!isTerminalKeyChordBuilding(state)) {
    return 'idle'
  }
  if (state.mainKey === null) {
    return 'needs-key'
  }
  return resolveTerminalKeyChord(state) === null ? 'blocked' : 'ready'
}

/** The bytes and label to send, or null while the chord is incomplete or has no encoding. */
export function resolveTerminalKeyChord(state: TerminalKeyChordState): TerminalKeyChordSend | null {
  const { mainKey } = state
  if (mainKey === null) {
    return null
  }
  if (mainKey.kind === 'shortcut') {
    // Why: a saved shortcut's bytes are fixed, so a modifier cannot be merged into them.
    return state.modifiers.length === 0 ? { label: mainKey.label, bytes: mainKey.bytes } : null
  }
  const bytes = buildTerminalKeyChordBytes(state.modifiers, mainKey.id)
  if (bytes === null) {
    return null
  }
  return { label: formatTerminalKeyChordLabel(terminalKeyChordParts(state)), bytes }
}

function mainKeyLabel(mainKey: TerminalKeyChordMainKey): string {
  return mainKey.kind === 'key' ? terminalKeyChordKeyLabel(mainKey.id) : mainKey.label
}

function isSameMainKey(a: TerminalKeyChordMainKey, b: TerminalKeyChordMainKey): boolean {
  return a.kind === b.kind && a.id === b.id
}
