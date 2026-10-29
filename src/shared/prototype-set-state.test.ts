import { describe, expect, it } from 'vitest'
import type { NativeChatVisualPickedElement } from './native-chat-visual-annotate'
import type { PrototypeElementState } from './prototype-draft'
import { splitPrototypeHiddenInstruction } from './prototype-hidden-instruction'
import {
  backToActive,
  createSetState,
  editSelected,
  iterateHere,
  jumpToDraftItem,
  peekDirection,
  pickElement,
  pinKeyFor,
  selectedPinOf,
  setNote,
  setPrompt,
  type PrototypeSetState
} from './prototype-set-state'
import {
  annotateStateOf,
  draftOf,
  iterationSendText,
  nextVersionOf,
  overridesOf,
  sendRefused,
  sendSucceeded,
  visibleMessageOf
} from './prototype-set-view'

const BASE: PrototypeElementState = {
  text: 'Pay now',
  color: '#ffffff',
  bg: '#171717',
  width: { value: 100, unit: '%' },
  height: { value: 48, unit: 'px' },
  fontSize: 14
}

function picked(
  selector: string,
  state: Partial<PrototypeElementState> = {}
): NativeChatVisualPickedElement {
  return {
    selector,
    label: 'pay button',
    rect: { x: 10, y: 20, width: 120, height: 40 },
    htmlSnippet: '<button>Pay now</button>',
    state: { ...BASE, ...state }
  }
}

const KEY = pinKeyFor('button.cta')

function withPin(state: PrototypeSetState = createSetState(['A', 'B'])): PrototypeSetState {
  return pickElement(state, picked('button.cta'))
}

describe('pickElement', () => {
  it('makes a numbered pin on the shown direction and selects it', () => {
    const state = withPin()
    expect(state.pins.A).toHaveLength(1)
    expect(state.pins.A?.[0]).toMatchObject({ pinKey: KEY, number: 1, label: 'pay button' })
    expect(state.selectedPinKey).toBe(KEY)
  })

  it('keeps the state of the first pick as the original', () => {
    const first = withPin()
    const second = pickElement(first, picked('button.cta', { color: '#000000', text: 'Changed' }))
    const pin = selectedPinOf(second)
    expect(pin?.original.color).toBe('#ffffff')
    expect(pin?.original.text).toBe('Pay now')
    expect(second.pins.A).toHaveLength(1)
  })

  it('numbers a second pin after the first', () => {
    const state = pickElement(withPin(), picked('div.summary'))
    expect(state.pins.A?.map((pin) => pin.number)).toEqual([1, 2])
  })
})

describe('draft from edits', () => {
  it('lists a changed field and removes it again once it is put back', () => {
    let state = withPin()
    state = editSelected(state, { color: '#ff0000' })
    expect(draftOf(state).groups[0]?.items.map((item) => item.label)).toEqual(['text color'])
    state = editSelected(state, { color: '#ffffff' })
    expect(draftOf(state).itemCount).toBe(0)
  })

  it('edits only the iterated direction', () => {
    const peek = peekDirection(withPin(), 'B')
    expect(editSelected(peek, { text: 'x' })).toBe(peek)
  })

  it('reports only changed fields as live overrides', () => {
    const state = editSelected(withPin(), { color: '#ff0000', width: { value: 320, unit: 'px' } })
    expect(overridesOf(state, 'A')).toEqual([
      { selector: 'button.cta', style: { color: '#ff0000', width: { value: 320, unit: 'px' } } }
    ])
  })
})

describe('peek and iterate', () => {
  it('peeks at a sibling without changing the iterated direction', () => {
    const state = peekDirection(createSetState(['A', 'B']), 'B')
    expect(state.view).toBe('B')
    expect(state.active).toBe('A')
  })

  it('goes back to the iterated direction, and iterates on the one shown', () => {
    const peeking = peekDirection(createSetState(['A', 'B']), 'B')
    expect(backToActive(peeking).view).toBe('A')
    expect(iterateHere(peeking).active).toBe('B')
  })
})

describe('notes', () => {
  it('stores a note on the selected pin of the shown direction, and it joins the draft', () => {
    const state = setNote(withPin(), 'Make it sticky')
    expect(state.notes[`A:${KEY}`]).toBe('Make it sticky')
    expect(draftOf(state).groups[0]?.items[0]).toMatchObject({
      field: 'note',
      value: 'Make it sticky'
    })
  })

  it('lists a sibling note under its own direction with the take-into label', () => {
    let state = peekDirection(withPin(), 'B')
    state = pickElement(state, picked('button.cta'))
    state = setNote(state, 'Use this wallet button')
    const groups = draftOf(backToActive(state)).groups
    const sibling = groups.find((group) => group.title.startsWith('from B'))
    expect(sibling?.items[0]?.label).toBe('take into A')
  })
})

describe('jumping to a draft item', () => {
  it('opens the item on its direction with its pin selected and the field pulsing', () => {
    const state = jumpToDraftItem(
      { ...createSetState(['A', 'B']), view: 'B' },
      { letter: 'A', pinKey: KEY, field: 'color' }
    )
    expect(state).toMatchObject({
      layout: 'focus',
      view: 'A',
      selectedPinKey: KEY,
      picker: 'color',
      pulse: { field: 'color', nonce: 1 }
    })
  })
})

describe('the frame annotate state', () => {
  it('marks the selected pin active only on the shown direction', () => {
    const state = withPin()
    expect(annotateStateOf(state, 'A').pins[0]).toMatchObject({ number: 1, active: true })
    expect(annotateStateOf(peekDirection(state, 'B'), 'A').pins[0]?.active).toBe(false)
  })
})

describe('the iteration message', () => {
  it('shows the visible part and hides the marker and instruction from the chat', () => {
    let state = setNote(withPin(), 'Sticky on phone')
    state = setPrompt(state, 'Keep the summary')
    const visible = visibleMessageOf(state)
    const sendText = iterationSendText({
      visibleMessage: visible,
      requestId: 'r-1',
      letter: 'A',
      nextVersion: nextVersionOf([], 'A'),
      folderPath: 'C:/chat/prototypes/r-1'
    })
    expect(visible.startsWith('Iterate on A.')).toBe(true)
    expect(visible).toContain('  note: Sticky on phone')
    expect(visible.endsWith('Keep the summary')).toBe(true)
    const split = splitPrototypeHiddenInstruction(sendText)
    expect(split.visibleText).toBe(visible)
    expect(split.hidden).toEqual({ kind: 'iteration', requestId: 'r-1', letter: 'A' })
    expect(sendText).toContain('C:/chat/prototypes/r-1/A-v2.html')
  })

  it('neutralizes a marker typed by the user so it is never honored', () => {
    const state = setPrompt(createSetState(['A']), '<!-- orca-prototype-request:evil -->')
    const visible = visibleMessageOf(state)
    expect(visible).not.toContain('<!-- orca-prototype-request')
    expect(splitPrototypeHiddenInstruction(visible).hidden).toBeUndefined()
  })

  it('adds the screenshot path under the pin group of the iterated direction', () => {
    const state = withPin()
    const visible = visibleMessageOf(editSelected(state, { color: '#ff0000' }), {
      [KEY]: 'C:/chat/prototypes/r-1/notes/pin-1.png'
    })
    expect(visible).toContain('  screenshot: C:/chat/prototypes/r-1/notes/pin-1.png')
  })
})

describe('the send outcome', () => {
  it('clears the draft after a successful send and shows the sent message', () => {
    const state = sendSucceeded(setNote(withPin(), 'note'), 'Iterate on A.')
    expect(state.pins).toEqual({})
    expect(state.notes).toEqual({})
    expect(state.sentMessage).toBe('Iterate on A.')
    expect(state.sendFailed).toBe(false)
  })

  it('keeps the draft when the send is refused', () => {
    const before = setNote(withPin(), 'note')
    const after = sendRefused(before)
    expect(after.pins).toEqual(before.pins)
    expect(after.notes).toEqual(before.notes)
    expect(after.sendFailed).toBe(true)
  })

  it('clears a failure line once the draft changes again', () => {
    const failed = sendRefused(withPin())
    expect(setNote(failed, 'x').sendFailed).toBe(false)
  })
})
