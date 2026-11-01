import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileChatStatusPillView } from './MobileChatStatusPillView'
import { mobileBridgeStatusPill, type MobileStatusPill } from './mobile-chat-status-pill'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Bot: 'Bot',
  Check: 'Check',
  SquareTerminal: 'SquareTerminal'
}))

const WITH_WORK: MobileStatusPill = {
  visible: true,
  idle: false,
  label: 'Working',
  elapsed: '4:12',
  terminals: 1,
  agents: 2,
  finished: null
}

describe('MobileChatStatusPillView', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(pill: MobileStatusPill, onPress?: () => void): ReactTestRenderer {
    act(() => {
      renderer = create(createElement(MobileChatStatusPillView, { pill, onPress }))
    })
    return renderer as ReactTestRenderer
  }

  it('is a button that opens the sheet, named with its clock and counts, when it has a tap', () => {
    const onPress = vi.fn()
    const mounted = mount(WITH_WORK, onPress)
    const button = mounted.root.find((node) => String(node.type) === 'Pressable')
    expect(button.props.accessibilityRole).toBe('button')
    expect(button.props.accessibilityLabel).toBe(
      'Show background work, Working, 4:12, 1 terminal, 2 agents'
    )
    act(() => button.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is a grouped status with no button role and no tap, when it has no sheet to open', () => {
    const mounted = mount(mobileBridgeStatusPill())
    expect(mounted.root.findAll((node) => String(node.type) === 'Pressable')).toHaveLength(0)
    const group = mounted.root.find((node) => node.props.accessible === true)
    expect(group.props.accessibilityLabel).toBe('Working')
    expect(group.props.accessibilityRole).toBeUndefined()
  })

  it('draws a count only when it is above zero, and the clock only when there is one', () => {
    const mounted = mount({ ...WITH_WORK, elapsed: null, agents: null })
    const counts = mounted.root.findAll(
      (node) => String(node.type) === 'Bot' || String(node.type) === 'SquareTerminal'
    )
    expect(counts.map((node) => node.type)).toEqual(['SquareTerminal'])
    const texts = mounted.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.children)
    expect(texts).not.toContainEqual(['4:12'])
  })

  it('reads an idle pill as Finished with the finished count, and still opens the sheet', () => {
    const onPress = vi.fn()
    const mounted = mount(
      {
        visible: true,
        idle: true,
        label: 'Finished',
        elapsed: null,
        terminals: null,
        agents: null,
        finished: 2
      },
      onPress
    )
    const button = mounted.root.find((node) => String(node.type) === 'Pressable')
    expect(button.props.accessibilityLabel).toBe('Show background work, Finished, 2 items')
    expect(mounted.root.findAll((node) => String(node.type) === 'Check')).toHaveLength(1)
    act(() => button.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
