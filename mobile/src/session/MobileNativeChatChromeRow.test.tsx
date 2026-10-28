import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileNativeChatChromeRow } from './MobileNativeChatChromeRow'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronsDownUp: 'ChevronsDownUp',
  ChevronsUpDown: 'ChevronsUpDown'
}))
vi.mock('./MobileBridgeBackgroundWork', () => ({
  MobileBridgeBackgroundWork: 'BridgeBackgroundWork'
}))
vi.mock('./MobileChatStatusPillView', () => ({ MobileBridgeWorkingPill: 'PlainWorkingPill' }))
vi.mock('./MobileNativeChatStopButton', () => ({ MobileNativeChatStopButton: 'StopButton' }))
vi.mock('./mobile-native-chat-view-styles', () => ({ styles: {} }))

type Props = Parameters<typeof MobileNativeChatChromeRow>[0]

describe('MobileNativeChatChromeRow', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(overrides: Partial<Props> = {}): ReactTestRenderer {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileNativeChatChromeRow, {
          structured: false,
          scopeKey: 'chat',
          working: true,
          toolsExpanded: false,
          onToggleTools: () => {},
          canStop: true,
          stopHeld: false,
          ...overrides
        })
      )
    })
    return mounted
  }

  function types(mounted: ReactTestRenderer, type: string): number {
    return mounted.root.findAll((node) => String(node.type) === type).length
  }

  it('hands the terminal pill the pane status, the chat scope and the connection', () => {
    const status = {
      state: 'working' as const,
      prompt: '',
      updatedAt: 1,
      stateStartedAt: 1,
      paneKey: 'tab:leaf',
      stateHistory: []
    }
    const mounted = render({ bridgeBackground: { status, connected: false } })

    const pill = mounted.root.find((node) => String(node.type) === 'BridgeBackgroundWork')
    expect(pill.props).toEqual({ scopeKey: 'chat', status, working: true, connected: false })
    expect(types(mounted, 'PlainWorkingPill')).toBe(0)
  })

  it('falls back to the plain working pill while a turn runs and nothing feeds the sheet', () => {
    const mounted = render()
    expect(types(mounted, 'PlainWorkingPill')).toBe(1)
    expect(
      render({ working: false }).root.findAll((n) => String(n.type) === 'PlainWorkingPill')
    ).toHaveLength(0)
  })

  it('draws no pill in a structured chat, which owns its pill above the composer', () => {
    const mounted = render({
      structured: true,
      bridgeBackground: { status: null, connected: true }
    })
    expect(types(mounted, 'BridgeBackgroundWork')).toBe(0)
    expect(types(mounted, 'PlainWorkingPill')).toBe(0)
  })

  it('holds Stop only while this phone request is in flight, and offers none when it cannot stop', () => {
    expect(
      render({ stopHeld: true }).root.find((node) => String(node.type) === 'StopButton').props.held
    ).toBe(true)
    expect(types(render({ canStop: false }), 'StopButton')).toBe(0)
  })

  it('toggles the tools row', () => {
    const onToggleTools = vi.fn()
    const mounted = render({ onToggleTools })
    act(() => mounted.root.find((node) => String(node.type) === 'Pressable').props.onPress())
    expect(onToggleTools).toHaveBeenCalledTimes(1)
  })
})
