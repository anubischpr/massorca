import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobilePrototypeViewportToggle } from './MobilePrototypeViewportToggle'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ Monitor: 'Monitor', Smartphone: 'Smartphone' }))

describe('MobilePrototypeViewportToggle', () => {
  let renderer: ReactTestRenderer | null = null
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(viewport: 'phone' | 'desktop', onChange = vi.fn()): ReactTestRenderer {
    act(() => {
      renderer = create(createElement(MobilePrototypeViewportToggle, { viewport, onChange }))
    })
    return renderer!
  }

  it('draws the phone and monitor icons, not the words', () => {
    const tree = mount('phone')
    expect(tree.root.findAllByType('Smartphone')).toHaveLength(1)
    expect(tree.root.findAllByType('Monitor')).toHaveLength(1)
    expect(tree.root.findAll((node) => node.type === 'Text')).toHaveLength(0)
  })

  it('names each button for a screen reader and marks the current screen', () => {
    const tree = mount('desktop')
    const buttons = tree.root.findAllByProps({ accessibilityRole: 'button' })
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Phone', 'Desktop'])
    expect(buttons.map((button) => button.props.accessibilityState.selected)).toEqual([false, true])
  })

  it('switches to the screen that was pressed', () => {
    const onChange = vi.fn()
    const tree = mount('phone', onChange)
    act(() => tree.root.findByProps({ accessibilityLabel: 'Desktop' }).props.onPress())
    expect(onChange).toHaveBeenCalledWith('desktop')
  })
})
