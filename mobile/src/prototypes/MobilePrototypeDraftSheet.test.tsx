import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import {
  createSetState,
  setPrompt,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { MobilePrototypeDraftSheet } from './MobilePrototypeDraftSheet'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))

function render(state: PrototypeSetState, onSend: () => void): ReactTestRenderer {
  const rendered: { tree?: ReactTestRenderer } = {}
  act(() => {
    rendered.tree = create(
      createElement(MobilePrototypeDraftSheet, {
        agentName: 'Claude',
        state,
        update: vi.fn(),
        onClose: vi.fn(),
        onJump: vi.fn(),
        onSend
      })
    )
  })
  if (rendered.tree === undefined) {
    throw new Error('the draft sheet did not render')
  }
  return rendered.tree
}

function sendButton(tree: ReactTestRenderer, onSend: () => void): ReactTestInstance {
  const [button] = tree.root.findAll((node) => node.props.onPress === onSend)
  if (button === undefined) {
    throw new Error('the send button is not rendered')
  }
  return button
}

describe('MobilePrototypeDraftSheet send button', () => {
  it('is disabled and dimmed while there is nothing to send', () => {
    const onSend = vi.fn()
    const send = sendButton(render(createSetState(['A', 'B']), onSend), onSend)

    expect(send.props.disabled).toBe(true)
    expect(send.props.style).toContainEqual({ opacity: 0.5 })
  })

  it('is enabled and undimmed once the message has text', () => {
    const onSend = vi.fn()
    const state = setPrompt(createSetState(['A', 'B']), 'Make the header bolder.')
    const send = sendButton(render(state, onSend), onSend)

    expect(send.props.disabled).toBe(false)
    expect(send.props.style).not.toContainEqual({ opacity: 0.5 })
  })
})
