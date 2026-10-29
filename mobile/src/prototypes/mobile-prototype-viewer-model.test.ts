import { describe, expect, it } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import {
  closeSelection,
  createSetState,
  editSelected,
  iterateHere,
  peekDirection,
  pickElement,
  pinKeyFor,
  setNote
} from '../../../src/shared/prototype-set-state'
import {
  FONT_SIZE_BOUNDS,
  NOTE_EXAMPLE_CHIPS,
  SIZE_PERCENT_BOUNDS,
  SIZE_PX_BOUNDS,
  isPeeking,
  noteFromExampleChip,
  noteLabelFor,
  notePlaceholderFor,
  parseNumberInput,
  pulseFieldFor,
  selectedPinEditCount,
  shownPinTab,
  sizeBoundsOf,
  viewerChips,
  viewerHeaderLines
} from './mobile-prototype-viewer-model'
import { listedSet, singleDirectionSet } from './mobile-prototype-sets.test-fixture'

const SET = listedSet()
const HEADING: NativeChatVisualPickedElement = {
  selector: 'main > h1',
  label: 'heading',
  rect: { x: 0, y: 0, width: 100, height: 24 },
  htmlSnippet: '<h1>Checkout</h1>',
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

  it('names no version for a direction the host lists with none', () => {
    const unversioned = {
      ...SET,
      directions: SET.directions.map((direction) =>
        direction.letter === 'B' ? { ...direction, versions: [] } : direction
      )
    }
    expect(viewerHeaderLines(unversioned, stateOnB()).subtitle).toBe('Codex · iterating')
  })
})

describe('the pin sheet tab and the jump pulse', () => {
  it('shows the Note tab while a sibling is peeked at, whatever tab was chosen', () => {
    expect(shownPinTab('edit', peekDirection(stateOnB(), 'C'))).toBe('note')
    expect(shownPinTab('edit', stateOnB())).toBe('edit')
    expect(shownPinTab('note', stateOnB())).toBe('note')
  })

  it('pulses the control a jump reached only while its pin is the one shown', () => {
    const picked = pickElement(stateOnB(), HEADING)
    const jump = { letter: 'B', pinKey: pinKeyFor(HEADING.selector), field: 'width' as const }
    expect(pulseFieldFor(jump, picked)).toBe('width')
    expect(pulseFieldFor(jump, closeSelection(picked))).toBeNull()
    expect(pulseFieldFor(jump, peekDirection(picked, 'C'))).toBeNull()
    expect(pulseFieldFor(null, picked)).toBeNull()
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
    expect(parseNumberInput('48', SIZE_PX_BOUNDS)).toBe(48)
    expect(parseNumberInput('12.5', SIZE_PX_BOUNDS)).toBe(12.5)
    expect(parseNumberInput('', SIZE_PX_BOUNDS)).toBeNull()
    expect(parseNumberInput('-', SIZE_PX_BOUNDS)).toBeNull()
    expect(parseNumberInput('abc', SIZE_PX_BOUNDS)).toBeNull()
    expect(parseNumberInput('Infinity', SIZE_PX_BOUNDS)).toBeNull()
  })

  it('pins a typed number into its range, so no field keeps an out-of-range value', () => {
    expect(parseNumberInput('99999', SIZE_PX_BOUNDS)).toBe(4000)
    expect(parseNumberInput('-5', SIZE_PX_BOUNDS)).toBe(0)
    expect(parseNumberInput('150', SIZE_PERCENT_BOUNDS)).toBe(100)
    expect(parseNumberInput('0', FONT_SIZE_BOUNDS)).toBe(1)
    expect(parseNumberInput('500', FONT_SIZE_BOUNDS)).toBe(200)
  })

  it('keeps a percentage to 0 to 100, and px and auto to the px range', () => {
    expect(sizeBoundsOf('%')).toBe(SIZE_PERCENT_BOUNDS)
    expect(sizeBoundsOf('px')).toBe(SIZE_PX_BOUNDS)
    expect(sizeBoundsOf('auto')).toBe(SIZE_PX_BOUNDS)
  })
})
