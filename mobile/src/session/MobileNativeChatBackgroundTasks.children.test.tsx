import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentChildRowContextForSessionStream } from '../../../src/shared/agent-child-row-stream-context'
import type { DelegatedChild } from '../../../src/shared/delegated-children'
import { structuredSessionBackgroundTasksView } from '../../../src/shared/structured-session-background-tasks-view'
import {
  MobileDelegatedChildContext,
  type MobileDelegatedChildAccess
} from './mobile-delegated-child-access'
import { MobileDelegatedChildrenContext } from './mobile-delegated-child-rows'
import { MobileNativeChatBackgroundTasks } from './MobileNativeChatBackgroundTasks'

const NOW = 10_000_000

vi.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 430, height: 900 }) },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Activity: 'Activity',
  Bot: 'Bot',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  ChevronUp: 'ChevronUp',
  CircleHelp: 'CircleHelp',
  SquareTerminal: 'SquareTerminal',
  Workflow: 'Workflow'
}))
vi.mock('../components/AgentStateDot', () => ({
  AGENT_WORKING_COLOR: '#eab308',
  AgentStateDot: 'AgentStateDot'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: 'MobileAgentIcon' }))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: ReactNode }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})
vi.mock('../hooks/use-now', () => ({ useNow: () => NOW }))

const running: DelegatedChild = {
  requestId: 'request-1',
  title: 'Explore Phase 3 improvements',
  status: 'working',
  agent: 'codex',
  model: null,
  effort: 'medium',
  automatic: true,
  childSessionId: 'child-1',
  startedAt: NOW - 4 * 60_000,
  resultSummary: null,
  durationMs: null,
  reason: null
}

function tasks(streamLive: boolean) {
  return {
    view: structuredSessionBackgroundTasksView(null, null),
    rowContext: agentChildRowContextForSessionStream(streamLive, 0),
    sessionKey: 'session-a',
    stop: vi.fn(async () => undefined)
  }
}

describe('MobileNativeChatBackgroundTasks with delegated children', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(
    children: readonly DelegatedChild[],
    access: MobileDelegatedChildAccess | null,
    streamLive = true
  ): ReactTestRenderer {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(
          MobileDelegatedChildContext.Provider,
          { value: access },
          createElement(
            MobileDelegatedChildrenContext.Provider,
            { value: { children, hostClockOffsetMs: 0 } },
            createElement(MobileNativeChatBackgroundTasks, { tasks: tasks(streamLive) })
          )
        )
      )
    })
    return mounted
  }

  function header(mounted: ReactTestRenderer): ReactTestInstance {
    const strip = mounted.root.find((node) => node.props.testID === 'background-tasks-strip')
    return strip.findAll((node) => String(node.type) === 'Pressable')[0]!
  }

  it('counts a running child as an agent in the pill while no task runs', () => {
    const mounted = mount([running], { hasChild: () => true, openChild: vi.fn() })

    expect(header(mounted).props.accessibilityLabel).toBe('Show background work, Working, 1 agent')
  })

  it('lists no pill for a child the lost stream can no longer vouch for', () => {
    const mounted = mount([running], { hasChild: () => true, openChild: vi.fn() }, false)

    expect(mounted.toJSON()).toBeNull()
  })

  it('opens the child from the sheet and closes the sheet first', () => {
    const openChild = vi.fn()
    const mounted = mount([running], { hasChild: () => true, openChild })
    act(() => header(mounted).props.onPress())
    const row = mounted.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.testID === 'background-child-row'
    )

    act(() => row.props.onPress())

    expect(openChild).toHaveBeenCalledWith('child-1')
    expect(mounted.root.findAll((node) => String(node.type) === 'BottomDrawer')).toHaveLength(0)
  })
})
