import { describe, expect, it } from 'vitest'
import { createSetState, keepListedLetters } from './prototype-set-state'

describe('keepListedLetters', () => {
  it('returns the same state while both letters are still in the set', () => {
    const state = { ...createSetState(['A', 'B']), active: 'B', view: 'A' }
    expect(keepListedLetters(state, ['A', 'B'])).toBe(state)
  })

  it('moves an iterated letter the set no longer has to its first direction, and clears a selection on it', () => {
    const state = {
      ...createSetState(['A', 'B', 'C']),
      active: 'C',
      view: 'C',
      selectedPinKey: 'pin-1',
      picker: 'color' as const
    }
    expect(keepListedLetters(state, ['A', 'B'])).toMatchObject({
      active: 'A',
      view: 'A',
      selectedPinKey: null,
      picker: null
    })
  })

  it('keeps a shown letter the set still has when only the iterated one went', () => {
    const state = { ...createSetState(['A', 'B', 'C']), active: 'C', view: 'B' }
    expect(keepListedLetters(state, ['A', 'B'])).toMatchObject({ active: 'A', view: 'B' })
  })
})
