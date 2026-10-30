import { describe, expect, it } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import {
  closeSelection,
  createSetState,
  editSelected,
  makeMain,
  openDirection,
  pickElement,
  pinKeyFor,
  setNote
} from '../../../src/shared/prototype-set-state'
import {
  FONT_SIZE_BOUNDS,
  SIZE_PERCENT_BOUNDS,
  SIZE_PX_BOUNDS,
  parseNumberInput,
  sizeBoundsOf
} from '../../../src/shared/prototype-number-input'
import {
  NOTE_EXAMPLE_CHIPS,
  NOTE_LABEL,
  NOTE_PLACEHOLDER,
  noteFromExampleChip,
  pulseFieldFor,
  readOnlySizeLine,
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
  return openDirection(makeMain(openDirection(createSetState(['A', 'B', 'C']), 'B')), 'B')
}

describe('viewerHeaderLines', () => {
  it('names the main and its latest version', () => {
    expect(viewerHeaderLines(SET, stateOnB())).toEqual({
      title: 'B · Split summary',
      subtitle: 'main · v2'
    })
  })

  it('says a direction that is not the main is read-only', () => {
    const readOnly = openDirection(stateOnB(), 'C')
    expect(viewerHeaderLines(SET, readOnly)).toEqual({ title: 'C', subtitle: 'read-only' })
  })

  it('names no version for a direction the host lists with none', () => {
    const unversioned = {
      ...SET,
      directions: SET.directions.map((direction) =>
        direction.letter === 'B' ? { ...direction, versions: [] } : direction
      )
    }
    expect(viewerHeaderLines(unversioned, stateOnB()).subtitle).toBe('main')
  })
})

describe('the jump pulse', () => {
  it('pulses the control a jump reached only while its pin is the one shown', () => {
    const picked = pickElement(stateOnB(), HEADING)
    const jump = { letter: 'B', pinKey: pinKeyFor(HEADING.selector), field: 'width' as const }
    expect(pulseFieldFor(jump, picked)).toBe('width')
    expect(pulseFieldFor(jump, closeSelection(picked))).toBeNull()
    expect(pulseFieldFor(jump, openDirection(picked, 'C'))).toBeNull()
    expect(pulseFieldFor(null, picked)).toBeNull()
  })
})

describe('viewerChips', () => {
  it('lists the directions and marks the main and the shown one', () => {
    const readOnly = openDirection(stateOnB(), 'C')
    expect(viewerChips(SET, readOnly)).toEqual([
      { letter: 'A', label: 'A', selected: false },
      { letter: 'B', label: 'B · main', selected: false },
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

  it('counts no edits on a read-only direction', () => {
    const edited = editSelected(pickElement(stateOnB(), HEADING), { fontSize: 18 })
    expect(selectedPinEditCount(openDirection(edited, 'C'))).toBe(0)
  })

  it('words the note for the main', () => {
    expect(NOTE_LABEL).toBe('Anything Edit can’t do, for this element')
    expect(NOTE_PLACEHOLDER).toBe('Describe a change Edit can’t do: animation, behavior, style…')
  })

  it('writes the read-only Size line as width, height and font size', () => {
    expect(readOnlySizeLine(HEADING.state)).toBe('100% × auto · 20px')
    expect(
      readOnlySizeLine({
        ...HEADING.state,
        width: { value: 100, unit: '%' },
        height: { value: 44, unit: 'px' },
        fontSize: 14
      })
    ).toBe('100% × 44px · 14px')
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
