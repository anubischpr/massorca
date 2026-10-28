import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import { MobileBridgeBackgroundWork } from './MobileBridgeBackgroundWork'

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
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  CircleHelp: 'CircleHelp',
  SquareTerminal: 'SquareTerminal',
  Workflow: 'Workflow'
}))
vi.mock('../components/AgentStateDot', () => ({
  AGENT_WORKING_COLOR: '#eab308',
  AgentStateDot: 'AgentStateDot'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: ReactNode }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})
vi.mock('../hooks/use-now', () => ({ useNow: () => NOW }))

function status(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'ship it',
    updatedAt: NOW - 1_000,
    stateStartedAt: NOW - 60_000,
    paneKey: 'tab:leaf',
    stateHistory: [],
    agentType: 'claude',
    ...overrides
  }
}

const EXPLORER: NonNullable<AgentStatusEntry['subagents']>[number] = {
  id: 'a1',
  agentType: 'Explore',
  description: 'Map the repo',
  state: 'working',
  startedAt: NOW - 30_000
}
const PLANNER: NonNullable<AgentStatusEntry['subagents']>[number] = {
  id: 'a2',
  agentType: 'Plan',
  description: 'Draft the plan',
  state: 'working',
  startedAt: NOW - 10_000
}

type Props = Parameters<typeof MobileBridgeBackgroundWork>[0]

describe('MobileBridgeBackgroundWork', () => {
  let renderer: ReactTestRenderer | null = null

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    vi.useRealTimers()
  })

  function props(overrides: Partial<Props> = {}): Props {
    return { scopeKey: 'chat', status: status(), working: true, connected: true, ...overrides }
  }

  function mount(initial: Props): { update: (next: Props) => void; root: ReactTestRenderer } {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileBridgeBackgroundWork, initial))
    })
    return {
      root: mounted,
      update: (next) =>
        act(() => {
          mounted.update(createElement(MobileBridgeBackgroundWork, next))
        })
    }
  }

  function textOf(node: ReactTestInstance): string {
    return node.children
      .map((child) => (typeof child === 'string' ? child : textOf(child)))
      .join('')
  }

  function pressables(mounted: ReactTestRenderer): ReactTestInstance[] {
    return mounted.root.findAll((node) => String(node.type) === 'Pressable')
  }

  function pill(mounted: ReactTestRenderer): ReactTestInstance {
    return pressables(mounted)[0]!
  }

  function rowTexts(mounted: ReactTestRenderer): string[] {
    return mounted.root.findAll((node) => node.props.testID === 'background-task-row').map(textOf)
  }

  function labelled(mounted: ReactTestRenderer, prefix: string): ReactTestInstance[] {
    return pressables(mounted).filter(
      (node) =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(prefix)
    )
  }

  it('draws nothing while the agent is idle and nothing runs', () => {
    const { root } = mount(props({ working: false, status: status({ state: 'done' }) }))
    expect(root.toJSON()).toBeNull()
  })

  it('shows a plain status pill, with no sheet to open, for a working turn with no background work', () => {
    const { root } = mount(props())

    expect(pressables(root)).toHaveLength(0)
    const view = root.root.find(
      (node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessible
    )
    expect(view.props.accessibilityLabel).toBe('Working, 1:00')
  })

  it('counts the running subagents in the pill and opens a sheet listing each with its elapsed time', () => {
    const { root } = mount(props({ status: status({ subagents: [EXPLORER, PLANNER] }) }))

    expect(pill(root).props.accessibilityLabel).toBe(
      'Show background work, Working, 1:00, 2 agents'
    )
    expect(rowTexts(root)).toEqual([])

    act(() => pill(root).props.onPress())

    expect(rowTexts(root)).toEqual(['Map the repo · Explore30s', 'Draft the plan · Plan10s'])
    // The host stops no pane subagent: no Stop on any row, and no stop-all.
    expect(labelled(root, 'Stop')).toHaveLength(0)
  })

  it('keeps the pill up for subagents that outlive the turn, with no clock', () => {
    const { root } = mount(
      props({
        working: false,
        status: status({
          subagents: [EXPLORER],
          mainAgent: { state: 'done', outcome: 'success', stateStartedAt: NOW - 5_000 }
        })
      })
    )

    expect(pill(root).props.accessibilityLabel).toBe('Show background work, Working, 1 agent')
  })

  it('moves a subagent that ends under a collapsed Finished section, opened on demand', () => {
    const { root, update } = mount(props({ status: status({ subagents: [EXPLORER, PLANNER] }) }))
    act(() => pill(root).props.onPress())

    update(props({ status: status({ subagents: [PLANNER] }) }))

    expect(rowTexts(root)).toEqual(['Draft the plan · Plan10s'])
    const toggle = labelled(root, 'Finished')[0]!
    expect(toggle.props.accessibilityLabel).toBe('Finished, 1')
    expect(toggle.props.accessibilityState).toEqual({ expanded: false })

    act(() => toggle.props.onPress())

    expect(labelled(root, 'Finished')[0]!.props.accessibilityState).toEqual({ expanded: true })
    expect(rowTexts(root)).toEqual(['Draft the plan · Plan10s', 'Map the repo · Ended30s'])
  })

  it('keeps a finished subagent after the agent goes idle and its pill is gone', () => {
    const { root, update } = mount(props({ status: status({ subagents: [EXPLORER] }) }))
    act(() => pill(root).props.onPress())

    update(props({ working: false, status: status({ state: 'done' }) }))

    // Nothing runs and no turn does, so the pill hides; the sheet closes with it.
    expect(root.toJSON()).toBeNull()

    update(props({ working: true, status: status() }))
    act(() => pill(root).props.onPress())
    expect(labelled(root, 'Finished')[0]!.props.accessibilityLabel).toBe('Finished, 1')
  })

  it('claims no status and finishes nothing while the host is not heard', () => {
    const { root, update } = mount(props({ status: status({ subagents: [EXPLORER] }) }))

    update(props({ connected: false, status: status({ subagents: [EXPLORER] }) }))
    expect(pill(root).props.accessibilityLabel).toBe('Show background work, Status unavailable')
    act(() => pill(root).props.onPress())
    expect(rowTexts(root)[0]).toContain('Map the repo')

    // A roster that reads empty while disconnected proves nothing, so nothing moves to Finished.
    update(props({ connected: false, status: status() }))
    expect(labelled(root, 'Finished')).toHaveLength(0)
  })

  it('says a monitoring pane runs work its status does not detail', () => {
    const { root } = mount(props({ working: false, status: status({ workingMode: 'monitoring' }) }))

    expect(pill(root).props.accessibilityLabel).toBe('Show background work, Working')
    act(() => pill(root).props.onPress())

    const notes = root.root
      .findAll((node) => String(node.type) === 'Text')
      .map(textOf)
      .filter((text) => text.startsWith('Background work is running'))
    expect(notes).toEqual(['Background work is running. This agent does not report its details.'])
  })

  it("starts another chat's Finished list over", () => {
    const { root, update } = mount(props({ status: status({ subagents: [EXPLORER] }) }))
    update(props({ status: status() }))
    expect(pill(root).props.accessibilityLabel).toContain('Show background work')

    update(props({ scopeKey: 'other-chat', status: status() }))

    expect(pressables(root)).toHaveLength(0)
  })
})
