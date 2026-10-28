import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileSessionHeaderMenu } from './mobile-session-header-menu'
import { MobileSessionHeaderMoreActionsSheet } from './MobileSessionHeaderMoreActionsSheet'

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
  ScrollText: 'ScrollText',
  Zap: 'Zap'
}))
vi.mock('../agent-history/MobileAgentSessionHistoryIcon', () => ({
  MobileAgentSessionHistoryIcon: 'MobileAgentSessionHistoryIcon'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({
      visible,
      onAfterClose,
      children
    }: {
      visible: boolean
      onAfterClose?: () => void
      children?: ReactNode
    }) =>
      visible ? React.createElement('BottomDrawer', { visible, onAfterClose }, children) : null
  }
})

const FULL: MobileSessionHeaderMenu = {
  showButton: true,
  hasChatSession: true,
  chat: {
    agentHistory: false,
    plan: true,
    summary: true,
    artifacts: true,
    quickCommands: true
  },
  environment: { branch: true, checks: true }
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileSessionHeaderMoreActionsSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(
    overrides: Partial<Parameters<typeof MobileSessionHeaderMoreActionsSheet>[0]> = {}
  ): { mounted: ReactTestRenderer; onOpenSummary: () => void; onClose: () => void } {
    act(() => renderer?.unmount())
    const onOpenSummary = vi.fn()
    const onClose = vi.fn()
    const props = {
      visible: true,
      menu: FULL,
      planHint: '2 of 5 done',
      recordedFileCount: 7,
      onOpenPlan: vi.fn(),
      onOpenSummary,
      onOpenArtifacts: vi.fn(),
      onOpenQuickCommands: vi.fn(),
      onOpenAgentHistory: vi.fn(),
      onOpenBranch: vi.fn(),
      onOpenChecks: vi.fn(),
      onClose,
      ...overrides
    }
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileSessionHeaderMoreActionsSheet, props))
    })
    return { mounted, onOpenSummary, onClose }
  }

  function rowLabels(mounted: ReactTestRenderer): string[] {
    return mounted.root
      .findAll((node) => String(node.type) === 'Pressable')
      .map((node) => node.props.accessibilityLabel)
  }

  it('draws nothing while closed', () => {
    const { mounted } = mount({ visible: false })
    expect(mounted.toJSON()).toBeNull()
  })

  it('lists the chat surfaces, then the environment, each with its count', () => {
    const { mounted } = mount()
    expect(rowLabels(mounted)).toEqual([
      'Plan',
      'Summary',
      'Artifacts',
      'Quick commands',
      'Branch',
      'Checks'
    ])
    const labels = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(labels).toEqual(expect.arrayContaining(['Chat', 'Environment', '2 of 5 done', '7']))
  })

  it('leaves out the plan row when the chat has no plan', () => {
    const { mounted } = mount({ menu: { ...FULL, chat: { ...FULL.chat, plan: false } } })
    expect(rowLabels(mounted)).not.toContain('Plan')
  })

  it('leaves out the environment section when no environment item applies', () => {
    const { mounted } = mount({
      menu: { ...FULL, environment: { branch: false, checks: false } }
    })
    const labels = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(labels).not.toContain('Environment')
    expect(rowLabels(mounted)).not.toContain('Branch')
  })

  it('closes first, then runs the choice once the menu has gone', () => {
    const { mounted, onOpenSummary, onClose } = mount()
    const summary = mounted.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Summary'
    )
    act(() => summary.props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenSummary).not.toHaveBeenCalled()
    const drawer = mounted.root.find((node) => String(node.type) === 'BottomDrawer')
    act(() => drawer.props.onAfterClose?.())
    expect(onOpenSummary).toHaveBeenCalledTimes(1)
  })

  it('offers agent history alone in the chat section when no native chat is open', () => {
    const { mounted } = mount({
      menu: {
        showButton: true,
        hasChatSession: false,
        chat: {
          agentHistory: true,
          plan: false,
          summary: false,
          artifacts: false,
          quickCommands: false
        },
        environment: { branch: true, checks: false }
      }
    })
    expect(rowLabels(mounted)).toEqual(['Agent history', 'Branch'])
  })

  it('runs agent history once the menu has gone, as the other choices do', () => {
    const onOpenAgentHistory = vi.fn()
    const { mounted, onClose } = mount({
      onOpenAgentHistory,
      menu: {
        showButton: true,
        hasChatSession: false,
        chat: {
          agentHistory: true,
          plan: false,
          summary: false,
          artifacts: false,
          quickCommands: false
        },
        environment: { branch: false, checks: false }
      }
    })
    const history = mounted.root.find(
      (node) =>
        String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Agent history'
    )
    act(() => history.props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenAgentHistory).not.toHaveBeenCalled()
    const drawer = mounted.root.find((node) => String(node.type) === 'BottomDrawer')
    act(() => drawer.props.onAfterClose?.())
    expect(onOpenAgentHistory).toHaveBeenCalledTimes(1)
  })
  it('holds Quick commands while a create is pending or the host is offline', () => {
    const { mounted } = mount({ quickCommandsDisabled: true })
    const row = mounted.root.find(
      (node) =>
        String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Quick commands'
    )
    expect(row.props.disabled).toBe(true)
  })

  it('keeps Plan, Summary and Artifacts listed but disabled, with the reason, without a chat', () => {
    const { mounted } = mount({ menu: { ...FULL, hasChatSession: false } })
    const row = (label: string) =>
      mounted.root.find(
        (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
      )
    const labels = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)

    expect(rowLabels(mounted)).toEqual([
      'Plan',
      'Summary',
      'Artifacts',
      'Quick commands',
      'Branch',
      'Checks'
    ])
    expect(row('Plan').props.disabled).toBe(true)
    expect(row('Summary').props.disabled).toBe(true)
    expect(row('Artifacts').props.disabled).toBe(true)
    expect(row('Quick commands').props.disabled).toBe(false)
    expect(labels.filter((text) => text === 'Start a chat first')).toHaveLength(3)
    expect(labels).not.toContain('2 of 5 done')
  })
})
