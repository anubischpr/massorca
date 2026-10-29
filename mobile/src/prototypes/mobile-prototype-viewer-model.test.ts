import { describe, expect, it } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import {
  createSetState,
  editSelected,
  iterateHere,
  peekDirection,
  pickElement,
  setNote
} from '../../../src/shared/prototype-set-state'
import {
  NOTE_EXAMPLE_CHIPS,
  isPeeking,
  noteFromExampleChip,
  noteLabelFor,
  notePlaceholderFor,
  parseNumberInput,
  selectedPinEditCount,
  viewerChips,
  viewerHeaderLines
} from './mobile-prototype-viewer-model'
import { listedSet, singleDirectionSet } from './mobile-prototype-sets.test-fixture'

const SET = listedSet()
const HEADING: NativeChatVisualPickedElement = {
  selector: 'main > h1',
  label: 'heading',
  rect: { x: 0, y: 0, width: 100, height: 24 },
  state: {
    text: 'Checkout',
    color: '#171717',
    bg: '#ffffff',
    width: { value: 100, unit: '%' },
    height: { value: 0, unit: 'auto' },
    fontSize: 20
  }
}

function stateOnB() {
  return peekDirection(iterateHere(peekDirection(createSetState(['A', 'B', 'C']), 'B')), 'B')
}

describe('viewerHeaderLines', () => {
  it('names the iterated direction and its latest version', () => {
    expect(viewerHeaderLines(SET, stateOnB())).toEqual({
      title: 'B · Split summary',
      subtitle: 'Codex · iterating · v2'
    })
  })

  it('says a sibling is being peeked at', () => {
    const peeking = peekDirection(stateOnB(), 'C')
    expect(viewerHeaderLines(SET, peeking)).toEqual({ title: 'C', subtitle: 'Codex · peeking' })
  })
})

describe('viewerChips', () => {
  it('lists the directions and marks the iterated one and the shown one', () => {
    const peeking = peekDirection(stateOnB(), 'C')
    expect(viewerChips(SET, peeking)).toEqual([
      { letter: 'A', label: 'A', selected: false },
      { letter: 'B', label: 'B · iterating', selected: false },
      { letter: 'C', label: 'C', selected: true }
    ])
  })

  it('has no chips for a one-direction set', () => {
    expect(viewerChips(singleDirectionSet(), createSetState(['A']))).toEqual([])
  })
})

describe('the pin sheet', () => {
  it('counts the edits of the selected pin, not its note', () => {
    let state = pickElement(stateOnB(), HEADING)
    expect(selectedPinEditCount(state)).toBe(0)
    state = editSelected(state, { color: '#ffffff', fontSize: 18 })
    state = setNote(state, 'Try weight 500.')
    expect(selectedPinEditCount(state)).toBe(2)
  })

  it('counts no edits while peeking', () => {
    const edited = editSelected(pickElement(stateOnB(), HEADING), { fontSize: 18 })
    expect(selectedPinEditCount(peekDirection(edited, 'C'))).toBe(0)
  })

  it('words the note for the shown direction', () => {
    const state = stateOnB()
    expect(isPeeking(state)).toBe(false)
    expect(noteLabelFor(state)).toBe('Anything Edit can’t do, for this element')
    expect(notePlaceholderFor(state)).toBe(
      'Describe a change Edit can’t do: animation, behavior, style…'
    )
    const peeking = peekDirection(state, 'C')
    expect(noteLabelFor(peeking)).toBe('What to take from C into B')
    expect(notePlaceholderFor(peeking)).toBe('e.g. use this wallet button above the card form')
  })

  it('writes an example chip on the selected element', () => {
    expect(NOTE_EXAMPLE_CHIPS).toEqual([
      'Animated rainbow border',
      'Shake on error',
      'Glassy background'
    ])
    expect(noteFromExampleChip('Shake on error', 'pay button')).toBe(
      'Shake on error on the pay button.'
    )
  })
})

describe('parseNumberInput', () => {
  it('reads a number and waits on anything that is not one yet', () => {
    expect(parseNumberInput('48')).toBe(48)
    expect(parseNumberInput('12.5')).toBe(12.5)
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('-')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
  })
})
