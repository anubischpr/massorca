// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../../shared/native-chat-visual-annotate'
import {
  createSetState,
  editSelected,
  makeMain,
  openDirection,
  pickElement,
  selectedPinOf,
  setNote,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { PrototypeEditPanel } from './PrototypeEditPanel'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

type Update = Mock<(transform: (state: PrototypeSetState) => PrototypeSetState) => void>

const PICKED: NativeChatVisualPickedElement = {
  selector: 'button.cta',
  label: 'pay button',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  htmlSnippet: '<button>Pay now</button>',
  state: {
    text: 'Pay now',
    color: '#ffffff',
    bg: '#171717',
    width: { value: 100, unit: '%' },
    height: { value: 48, unit: 'px' },
    fontSize: 14
  }
}

function pinnedState(): PrototypeSetState {
  return pickElement(createSetState(['A']), PICKED)
}

/** The state the panel's last update leaves when applied to the state the panel was given. */
function stateAfterLastUpdate(update: Update, state: PrototypeSetState): PrototypeSetState {
  const transform = update.mock.lastCall?.[0]
  if (transform === undefined) {
    throw new Error('expected the panel to update the state')
  }
  return transform(state)
}

describe('PrototypeEditPanel rows for a button pin', () => {
  afterEach(cleanup)

  it('names the width and height unit groups', () => {
    render(<PrototypeEditPanel state={pinnedState()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByRole('group', { name: 'Width unit' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Height unit' })).toBeInTheDocument()
  })

  it('shows the Text color and Fill rows, as for any element', () => {
    render(<PrototypeEditPanel state={pinnedState()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByText('Text color')).toBeInTheDocument()
    expect(screen.getByText('Fill')).toBeInTheDocument()
  })
})

describe('PrototypeEditPanel number fields', () => {
  afterEach(cleanup)

  it('shows a number pinned to its bound, commits nothing for a blank entry, and resyncs on blur', () => {
    const update: Update = vi.fn()
    render(<PrototypeEditPanel state={pinnedState()} update={update} pulseField={null} />)
    const width = screen.getByLabelText('Width value')

    fireEvent.change(width, { target: { value: '250' } })
    expect(width).toHaveValue(100)
    fireEvent.change(width, { target: { value: '' } })
    expect(update).toHaveBeenCalledTimes(1)
    fireEvent.blur(width)
    expect(width).toHaveValue(100)
  })

  it('pins a value into the range of the unit it changes to', () => {
    const update: Update = vi.fn()
    const tall = {
      ...PICKED,
      state: { ...PICKED.state, height: { value: 500, unit: 'px' as const } }
    }
    const state = pickElement(createSetState(['A']), tall)
    render(<PrototypeEditPanel state={state} update={update} pulseField={null} />)
    const heightUnits = screen.getByRole('group', { name: 'Height unit' })

    fireEvent.click(within(heightUnits).getByRole('button', { name: '%' }))
    expect(selectedPinOf(stateAfterLastUpdate(update, state))?.current.height).toEqual({
      value: 100,
      unit: '%'
    })
  })

  it('pins a typed width to its unit range, and a typed px height to 4000', () => {
    const update: Update = vi.fn()
    const state = pinnedState()
    render(<PrototypeEditPanel state={state} update={update} pulseField={null} />)

    fireEvent.change(screen.getByLabelText('Width value'), { target: { value: '250' } })
    expect(selectedPinOf(stateAfterLastUpdate(update, state))?.current.width).toEqual({
      value: 100,
      unit: '%'
    })

    fireEvent.change(screen.getByLabelText('Height value'), { target: { value: '9999' } })
    expect(selectedPinOf(stateAfterLastUpdate(update, state))?.current.height).toEqual({
      value: 4000,
      unit: 'px'
    })
  })

  it('pins a typed font size into 1 to 200', () => {
    const update: Update = vi.fn()
    const state = pinnedState()
    render(<PrototypeEditPanel state={state} update={update} pulseField={null} />)
    const fontSize = screen.getByDisplayValue('14')

    fireEvent.change(fontSize, { target: { value: '500' } })
    expect(selectedPinOf(stateAfterLastUpdate(update, state))?.current.fontSize).toBe(200)

    fireEvent.change(fontSize, { target: { value: '0' } })
    expect(selectedPinOf(stateAfterLastUpdate(update, state))?.current.fontSize).toBe(1)
  })

  it('leaves the value alone while the typed text is empty', () => {
    const update: Update = vi.fn()
    render(<PrototypeEditPanel state={pinnedState()} update={update} pulseField={null} />)

    fireEvent.change(screen.getByLabelText('Height value'), { target: { value: '' } })

    expect(update).not.toHaveBeenCalled()
  })
})

/** A had a pin with an edit and a note while it was the main; B is the main now and A is shown read-only. */
function formerMainShown(): PrototypeSetState {
  let state = pickElement(createSetState(['A', 'B']), PICKED)
  state = setNote(editSelected(state, { color: '#ff0000' }), 'Heavy header')
  state = makeMain(openDirection(state, 'B'))
  return pickElement(openDirection(state, 'A'), PICKED)
}

function readOnlyOnB(): PrototypeSetState {
  return pickElement(openDirection(createSetState(['A', 'B']), 'B'), PICKED)
}

describe('PrototypeEditPanel on a read-only direction', () => {
  afterEach(cleanup)

  it('shows the properties under "Properties · read-only", not "Edit", every control disabled', () => {
    render(<PrototypeEditPanel state={readOnlyOnB()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByText('Properties · read-only')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).toBeNull()
    for (const control of [
      screen.getByDisplayValue('Pay now'),
      screen.getByLabelText('Width value'),
      screen.getByLabelText('Text color hex'),
      screen.getByRole('button', { name: 'Text color #171717' }),
      screen.getByRole('button', { name: 'Custom fill' })
    ]) {
      expect(control).toBeDisabled()
    }
  })

  it('shows the values of that direction own state', () => {
    render(<PrototypeEditPanel state={formerMainShown()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByLabelText('Text color hex')).toHaveValue('#ff0000')
  })

  it('takes no note: no input, no example chips', () => {
    render(<PrototypeEditPanel state={readOnlyOnB()} update={vi.fn()} pulseField={null} />)
    expect(screen.queryByRole('textbox', { name: /Note/u })).toBeNull()
    expect(screen.queryByPlaceholderText(/Describe a change/u)).toBeNull()
    expect(screen.queryByText('Shake on error')).toBeNull()
  })

  it('shows an existing note as text under "Note"', () => {
    render(<PrototypeEditPanel state={formerMainShown()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Heavy header')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Describe a change/u)).toBeNull()
  })

  it('shows no Note heading at all when the direction has no note', () => {
    render(<PrototypeEditPanel state={readOnlyOnB()} update={vi.fn()} pulseField={null} />)
    expect(screen.queryByText('Note')).toBeNull()
  })

  it('keeps the footer line, as the board does', () => {
    render(<PrototypeEditPanel state={readOnlyOnB()} update={vi.fn()} pulseField={null} />)
    expect(
      screen.getByText(
        'Every change and note joins the draft on its own. Put a value back to remove it.'
      )
    ).toBeInTheDocument()
  })

  it('keeps the Edit heading, enabled controls and the note input on the main', () => {
    render(<PrototypeEditPanel state={pinnedState()} update={vi.fn()} pulseField={null} />)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Properties · read-only')).toBeNull()
    expect(screen.getByLabelText('Width value')).toBeEnabled()
    expect(screen.getByPlaceholderText(/Describe a change/u)).toBeInTheDocument()
  })
})
