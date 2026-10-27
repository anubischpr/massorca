import { type ReactNode, createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileSessionHeaderMoreActionsSheet } from './MobileSessionHeaderMoreActionsSheet'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Files: 'Files',
  GitBranch: 'GitBranch',
  ListChecks: 'ListChecks',
  ListTodo: 'ListTodo',
  MessagesSquare: 'MessagesSquare',
  ScrollText: 'ScrollText'
}))
vi.mock('../agent-history/MobileAgentSessionHistoryIcon', () => ({
  MobileAgentSessionHistoryIcon: 'MobileAgentSessionHistoryIcon'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({
      visible,
      onClose,
      onAfterClose,
      children
    }: {
      visible: boolean
      onClose: () => void
      onAfterClose?: () => void
      children?: ReactNode
    }) =>
      visible ? React.createElement('BottomDrawer', { onClose, onAfterClose }, children) : null
  }
})

function menuFor(options: { showNativeChat?: boolean; showAgentHistory?: boolean }) {
  return resolveMobileSessionHeaderMenu({
    showNativeChat: options.showNativeChat ?? false,
    showAgentHistory: options.showAgentHistory ?? false,
    hasSourceControl: true,
    showChecks: false,
    hasPlan: false
  })
}

describe('MobileSessionHeaderMoreActionsSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(
    menu: ReturnType<typeof menuFor>,
    handlers: { onOpenAgentHistory: () => void; onClose: () => void }
  ): ReactTestRenderer {
    const noop = () => {}
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileSessionHeaderMoreActionsSheet, {
          visible: true,
          menu,
          tabCount: 1,
          recordedFileCount: 0,
          onOpenSessions: noop,
          onOpenPlan: noop,
          onOpenSummary: noop,
          onOpenArtifacts: noop,
          onOpenAgentHistory: handlers.onOpenAgentHistory,
          onOpenBranch: noop,
          onOpenChecks: noop,
          onClose: handlers.onClose
        })
      )
    })
    return mounted
  }

  function rowLabels(mounted: ReactTestRenderer): string[] {
    return mounted.root
      .findAll((node) => String(node.type) === 'Pressable')
      .map((node) => node.props.accessibilityLabel)
  }

  function rowNamed(mounted: ReactTestRenderer, label: string): ReactTestInstance {
    return mounted.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
    )
  }

  it('offers agent history alone without a native chat, and runs it once the menu has closed', () => {
    const onOpenAgentHistory = vi.fn()
    const onClose = vi.fn()
    const mounted = render(menuFor({ showAgentHistory: true }), { onOpenAgentHistory, onClose })
    expect(rowLabels(mounted)).toEqual(['Agent history', 'Branch'])

    act(() => rowNamed(mounted, 'Agent history').props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenAgentHistory).not.toHaveBeenCalled()

    const drawer = mounted.root.find((node) => String(node.type) === 'BottomDrawer')
    act(() => drawer.props.onAfterClose())
    expect(onOpenAgentHistory).toHaveBeenCalledTimes(1)
  })

  it('leaves history to the Sessions sheet beside a native chat', () => {
    const mounted = render(menuFor({ showNativeChat: true, showAgentHistory: true }), {
      onOpenAgentHistory: vi.fn(),
      onClose: vi.fn()
    })
    expect(rowLabels(mounted)).toContain('Sessions')
    expect(rowLabels(mounted)).not.toContain('Agent history')
  })
})
