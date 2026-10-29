// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('PrototypeEditPanel number fields', () => {
  afterEach(cleanup)

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
