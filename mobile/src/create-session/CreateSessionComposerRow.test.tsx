import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { CreateSessionComposerRow } from './CreateSessionComposerRow'
import type { CreateSessionOptions } from './use-create-session-options'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ArrowUp: 'ArrowUp' }))
vi.mock('../session/MobileNativeChatSessionOptionPickers', () => ({
  MobileNativeChatSessionOptionPickers: 'OptionPickers'
}))

const options: CreateSessionOptions = {
  controller: {
    snapshot: [],
    pendingId: null,
    setOption: () => Promise.resolve(false),
    invokeAction: () => Promise.resolve(false),
    recordCommand: () => {}
  },
  picks: {},
  effectiveModelId: null
}

function mount(canSubmit: boolean, onSubmit: () => void) {
  let renderer: ReturnType<typeof create> | null = null
  act(() => {
    renderer = create(
      createElement(CreateSessionComposerRow, { agent: 'claude', options, canSubmit, onSubmit })
    )
  })
  if (!renderer) {
    throw new Error('did not render')
  }
  const root = (renderer as ReturnType<typeof create>).root
  return root.findByProps({ accessibilityLabel: 'Create session' })
}

describe('CreateSessionComposerRow', () => {
  it('keeps the create button disabled until there is something to send', () => {
    const onSubmit = vi.fn()
    const button = mount(false, onSubmit)
    expect(button.props.disabled).toBe(true)
    expect(button.props.accessibilityState).toEqual({ disabled: true })
  })

  it('creates the session when the button is pressed', () => {
    const onSubmit = vi.fn()
    const button = mount(true, onSubmit)
    expect(button.props.disabled).toBe(false)
    act(() => button.props.onPress())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
