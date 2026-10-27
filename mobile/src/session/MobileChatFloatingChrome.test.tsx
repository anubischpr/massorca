import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileChatChromeLayoutContext } from './mobile-chat-chrome-layout'
import { MobileChatFloatingChrome } from './MobileChatFloatingChrome'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1, absoluteFillObject: {} },
  Text: 'Text',
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 })
}))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Folder: 'Folder',
  GitBranch: 'GitBranch',
  MessageSquare: 'MessageSquare',
  MoreHorizontal: 'MoreHorizontal'
}))
vi.mock('../components/StatusDot', () => ({ StatusDot: 'StatusDot' }))
vi.mock('./MobileSessionSwitcherChip', () => ({ MobileSessionSwitcherChip: 'SwitcherChip' }))
vi.mock('./mobile-structured-pi-runtime-record', () => ({
  useMobileStructuredPiRuntimeVersion: () => 0
}))

function controllerWith(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    requestLeaveSession: vi.fn(),
    activePanel: null,
    setActivePanel: vi.fn(),
    handlePanelTap: vi.fn(),
    isFolderWorkspaceRoute: false,
    isFloatingWorkspaceRoute: false,
    showHeaderMoreButton: true,
    setShowHeaderMoreActions: vi.fn(),
    activeSessionRow: null,
    sessionRows: [],
    openSessionsSheet: vi.fn(),
    hostId: 'host-1',
    connState: 'disconnected',
    showConnectionRetry: false,
    forceReconnectHost: vi.fn(() => Promise.resolve()),
    ...overrides
  } as unknown as MobileSessionController
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileChatFloatingChrome', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(controller: MobileSessionController, setHeight = vi.fn()) {
    const tree = (node: ReactNode) =>
      createElement(
        MobileChatChromeLayoutContext.Provider,
        { value: { height: 0, setHeight } },
        node
      )
    act(() => {
      renderer = create(tree(createElement(MobileChatFloatingChrome, { controller })))
    })
    return { mounted: renderer as ReactTestRenderer, setHeight }
  }

  it('offers no connection state while no retry is shown', () => {
    const { mounted } = mount(controllerWith({ showConnectionRetry: false }))
    const labels = mounted.root
      .findAll((node) => node.props.accessibilityLabel !== undefined)
      .map((node) => node.props.accessibilityLabel)
    expect(labels).not.toContain('Reconnect to desktop')
  })

  it('shows a tappable Reconnect to desktop, which asks the host to reconnect', () => {
    const forceReconnectHost = vi.fn(() => Promise.resolve())
    const { mounted } = mount(
      controllerWith({ showConnectionRetry: true, forceReconnectHost, hostId: 'host-9' })
    )
    const reconnect = mounted.root.find(
      (node) => node.props.accessibilityLabel === 'Reconnect to desktop'
    )
    expect(textOf(reconnect)).toBe('Reconnect to desktop')
    act(() => reconnect.props.onPress())
    expect(forceReconnectHost).toHaveBeenCalledWith('host-9')
  })

  it('publishes its measured height to the content column, and clears it when it goes', () => {
    const { mounted, setHeight } = mount(controllerWith())
    const layer = mounted.root.find((node) => node.type === 'View' && node.props.onLayout)
    act(() => layer.props.onLayout({ nativeEvent: { layout: { height: 151 } } }))
    expect(setHeight).toHaveBeenCalledWith(151)
    act(() => renderer?.unmount())
    renderer = null
    expect(setHeight).toHaveBeenLastCalledWith(0)
  })
})
