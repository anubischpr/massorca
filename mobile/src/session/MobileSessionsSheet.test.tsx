import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileSessionTab } from './mobile-session-route-types'
import type { MobileSessionSwitcherRow } from './mobile-session-switcher-rows'
import { MobileSessionsSheet } from './MobileSessionsSheet'
import { getMobileSessionTabTitle } from './mobile-terminal-tab-agent'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  File: 'File',
  FileText: 'FileText',
  Globe: 'Globe',
  Plus: 'Plus',
  SquareTerminal: 'SquareTerminal'
}))
vi.mock('../agent-history/MobileAgentSessionHistoryIcon', () => ({
  MobileAgentSessionHistoryIcon: 'MobileAgentSessionHistoryIcon'
}))
vi.mock('../components/AgentStateDot', () => ({ AgentStateDot: 'AgentStateDot' }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: 'MobileAgentIcon' }))
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

const terminal: MobileSessionTab = {
  type: 'terminal',
  id: 'tab-term',
  title: 'npm test',
  terminal: 'term-1',
  isActive: true
}
const chat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-chat',
  title: 'Fix login',
  sessionId: 'session-1',
  agent: 'claude',
  isActive: false
}
const markdown: MobileSessionTab = {
  type: 'markdown',
  id: 'tab-md',
  title: 'README',
  filePath: '/repo/README.md',
  relativePath: 'README.md',
  isDirty: false,
  isActive: false,
  documentVersion: '1'
}
const rows: MobileSessionSwitcherRow<MobileSessionTab>[] = [
  { tab: terminal, isActive: true, status: 'working' },
  { tab: chat, isActive: false, status: 'idle' },
  { tab: markdown, isActive: false, status: null }
]

type Props = Parameters<typeof MobileSessionsSheet>[0]

function propsWith(overrides: Partial<Props>): Props {
  return {
    visible: true,
    rows,
    showResume: false,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onNewTab: vi.fn(),
    onResume: vi.fn(),
    onTabActions: vi.fn(),
    ...overrides
  }
}

describe('MobileSessionsSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(props: Props): ReactTestRenderer {
    act(() => renderer?.unmount())
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileSessionsSheet, props))
    })
    return mounted
  }

  function rowNamed(mounted: ReactTestRenderer, label: string): ReactTestInstance {
    return mounted.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
    )
  }

  function drawerOf(mounted: ReactTestRenderer): ReactTestInstance {
    return mounted.root.find((node) => String(node.type) === 'BottomDrawer')
  }

  function textsOf(mounted: ReactTestRenderer): string[] {
    return mounted.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.props.children)
  }

  it('nests a child tab under its parent, and keeps the flat list without lineage', () => {
    const child: MobileSessionTab = {
      ...chat,
      id: 'tab-child',
      title: 'Explore v5',
      sessionId: 'child-1'
    }
    const nestedRows: MobileSessionSwitcherRow<MobileSessionTab>[] = [
      { tab: chat, isActive: false, status: 'idle' },
      { tab: child, isActive: false, status: null },
      { tab: terminal, isActive: true, status: 'working' }
    ]
    const tabLabels = (mounted: ReactTestRenderer) =>
      mounted.root
        .findAll((node) => String(node.type) === 'Pressable')
        .map((node) => node.props.accessibilityLabel)
        .filter((label) => ['Fix login', 'Explore v5', 'npm test'].includes(label))

    const nested = mount(
      propsWith({ rows: nestedRows, childParentTabIds: new Map([['tab-child', 'tab-chat']]) })
    )
    const childGroups = nested.root.findAll((node) => node.props.testID === 'session-child-rows')
    expect(childGroups).toHaveLength(1)
    expect(
      childGroups[0]!
        .findAll((node) => String(node.type) === 'Pressable')
        .map((node) => node.props.accessibilityLabel)
    ).toEqual(['Explore v5'])
    expect(tabLabels(nested)).toEqual(['Fix login', 'Explore v5', 'npm test'])

    const flat = mount(propsWith({ rows: nestedRows }))
    expect(flat.root.findAll((node) => node.props.testID === 'session-child-rows')).toHaveLength(0)
    expect(tabLabels(flat)).toEqual(['Fix login', 'Explore v5', 'npm test'])
  })

  it('selects a nested child tab and closes the sheet at once', () => {
    const child: MobileSessionTab = {
      ...chat,
      id: 'tab-child',
      title: 'Explore v5',
      sessionId: 'child-1'
    }
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const mounted = mount(
      propsWith({
        rows: [
          { tab: chat, isActive: false, status: 'idle' },
          { tab: child, isActive: false, status: null }
        ],
        childParentTabIds: new Map([['tab-child', 'tab-chat']]),
        onSelect,
        onClose
      })
    )
    act(() => rowNamed(mounted, 'Explore v5').props.onPress())

    expect(onSelect).toHaveBeenCalledWith(child)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('labels each tab by its agent status, or by its kind when it reports none', () => {
    const texts = textsOf(mount(propsWith({})))
    expect(texts).toEqual(expect.arrayContaining(['Working', 'Idle', 'Markdown']))
  })

  it('selects a tab and closes the sheet at once', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const mounted = mount(propsWith({ onSelect, onClose }))
    act(() => rowNamed(mounted, 'Fix login').props.onPress())
    expect(onSelect).toHaveBeenCalledWith(chat)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('starts a new tab only after the sheet has closed', () => {
    const onNewTab = vi.fn()
    const onClose = vi.fn()
    const mounted = mount(propsWith({ onNewTab, onClose }))
    act(() => rowNamed(mounted, 'New tab').props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onNewTab).not.toHaveBeenCalled()
    act(() => drawerOf(mounted).props.onAfterClose())
    expect(onNewTab).toHaveBeenCalledTimes(1)
  })

  it('opens a tab close and rename actions by a hold, only after the sheet has closed', () => {
    const onTabActions = vi.fn()
    const onClose = vi.fn()
    const mounted = mount(propsWith({ onTabActions, onClose }))
    const row = mounted.root.find(
      (node) => node.props.accessibilityLabel === getMobileSessionTabTitle(chat)
    )
    act(() => row.props.onLongPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onTabActions).not.toHaveBeenCalled()
    act(() => drawerOf(mounted).props.onAfterClose())
    expect(onTabActions).toHaveBeenCalledWith(chat)
  })

  it('offers resume only where history applies, and runs it after the sheet closes', () => {
    const hidden = mount(propsWith({ showResume: false }))
    expect(textsOf(hidden)).not.toContain('Resume an earlier session')

    const onResume = vi.fn()
    const onClose = vi.fn()
    const shown = mount(propsWith({ showResume: true, onResume, onClose }))
    const resume = shown.root.find(
      (node) =>
        String(node.type) === 'Pressable' &&
        node.findAll((child) => child.props.children === 'Resume an earlier session').length > 0
    )
    act(() => resume.props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onResume).not.toHaveBeenCalled()
    act(() => drawerOf(shown).props.onAfterClose())
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('says where terminals live, since the sheet lists chats only', () => {
    expect(textsOf(mount(propsWith({})))).toContain(
      'Terminals live in the Terminal view, not here.'
    )
  })
})
