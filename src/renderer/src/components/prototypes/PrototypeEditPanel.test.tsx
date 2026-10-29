// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../../shared/native-chat-visual-annotate'
import {
  createSetState,
  pickElement,
  selectedPinOf,
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
    const heightUnits = screen.getAllByRole('group')[1]
    if (heightUnits === undefined) {
      throw new Error('expected a unit group for each of Width and Height')
    }

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
