import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentChildRowContextForSessionStream } from '../../../src/shared/agent-child-row-stream-context'
import type { AgentChildWorkView } from '../../../src/shared/agent-status-child-work-view'
import type { AgentSessionBackgroundTaskState } from '../../../src/shared/agent-session-wire'
import { structuredSessionBackgroundTasksView } from '../../../src/shared/structured-session-background-tasks-view'
import { MobileNativeChatBackgroundTasks } from './MobileNativeChatBackgroundTasks'
import { resetSeenBackgroundWorkStoreForTests } from './mobile-seen-background-work-store'

const NOW = 10_000_000
const windowWidth = vi.hoisted(() => ({ value: 430 }))

vi.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: windowWidth.value, height: 900 }) },
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
  ChevronUp: 'ChevronUp',
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
    BottomDrawer: ({
      visible,
      onClose,
      children
    }: {
      visible: boolean
      onClose?: () => void
      children?: ReactNode
    }) => (visible ? React.createElement('BottomDrawer', { visible, onClose }, children) : null)
  }
})
vi.mock('../hooks/use-now', () => ({ useNow: () => NOW }))

function view(id: string, overrides: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    providerId: `task-${id}`,
    kind: 'agent',
    description: `review ${id}`,
    state: 'working',
    membership: 'live',
    firstObservedAt: NOW - 65_000,
    observedAt: NOW - 1_000,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 },
    ...overrides
  }
}

type Props = Parameters<typeof MobileNativeChatBackgroundTasks>[0]

function tasksFor(
  state: AgentSessionBackgroundTaskState | null,
  options: {
    streamLive?: boolean
    hostClockOffsetMs?: number
    stop?: (taskId?: string) => Promise<unknown>
    commandActivity?: AgentChildWorkView[]
  } = {}
): Props['tasks'] {
  return {
    view: structuredSessionBackgroundTasksView(state, null),
    rowContext: agentChildRowContextForSessionStream(
      options.streamLive ?? true,
      options.hostClockOffsetMs ?? 0
    ),
    sessionKey: 'session-a',
    stop: options.stop ?? vi.fn(async () => undefined),
    ...(options.commandActivity ? { commandActivity: options.commandActivity } : {})
  }
}

// The sheet's empty-state line, whichever copy it carries.
const EMPTY_NOTES = [
  'No background work is running.',
  'Task details are unavailable for this session.'
]

describe('MobileNativeChatBackgroundTasks', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    windowWidth.value = 430
    // The seen work is module-level; each test starts with no chat kept.
    resetSeenBackgroundWorkStoreForTests()
  })

  function mount(tasks: Props['tasks']): ReactTestRenderer {
    act(() => renderer?.unmount())
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileNativeChatBackgroundTasks, { tasks }))
    })
    return mounted
  }

  function textOf(node: ReactTestInstance): string {
    return node.children
      .map((child) => (typeof child === 'string' ? child : textOf(child)))
      .join('')
  }

  function styleOf(node: ReactTestInstance): Record<string, unknown> {
    const rendered: unknown =
      typeof node.props.style === 'function'
        ? node.props.style({ pressed: false })
        : node.props.style
    const parts = Array.isArray(rendered) ? rendered : [rendered]
    return Object.assign(
      {},
      ...parts.filter(
        (part): part is Record<string, unknown> => typeof part === 'object' && part !== null
      )
    )
  }

  // The indicator is the strip's first pressable; the sheet's controls come after it in the tree.
  function header(mounted: ReactTestRenderer): ReactTestInstance {
    const strip = mounted.root.find((node) => node.props.testID === 'background-tasks-strip')
    return strip.findAll((node) => String(node.type) === 'Pressable')[0]!
  }

  function sheetTitles(mounted: ReactTestRenderer): ReactTestInstance[] {
    return mounted.root.findAll(
      (node) => String(node.type) === 'Text' && node.props.children === 'Background work'
    )
  }

  function expand(mounted: ReactTestRenderer): void {
    act(() => header(mounted).props.onPress())
  }

  function stopButtons(mounted: ReactTestRenderer): ReactTestInstance[] {
    return mounted.root.findAll(
      (node) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Stop')
    )
  }

  it('draws nothing while no child work runs', () => {
    expect(mount(tasksFor(null)).toJSON()).toBeNull()
    expect(
      mount(
        tasksFor({ state: 'monitoring', settledTasks: [{ id: 'old', kind: 'agent' }] })
      ).toJSON()
    ).toBeNull()
  })

  it('counts the running agents in the pill, and hides the zero terminal count', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a'), view('b')] }))
    expect(header(mounted).props.accessibilityLabel).toBe('Show background work, Working, 2 agents')
  })
  it('opens the sheet to rows in their section, with tokens and elapsed', () => {
    const mounted = mount(
      tasksFor({ state: 'monitoring', children: [view('a', { totalTokens: 18_130 })] })
    )
    expect(
      mounted.root.findAll((node) => node.props.testID === 'background-task-row')
    ).toHaveLength(0)
    expand(mounted)
    const rows = mounted.root.findAll((node) => node.props.testID === 'background-task-row')
    expect(rows.map(textOf)).toEqual(['review a · Agent18.1k · 1m 5s'])
    // Uppercased by style, so a screen reader hears the word itself.
    const label = mounted.root.find(
      (node) => String(node.type) === 'Text' && node.props.children === 'Agents'
    )
    expect(label.props.style).toMatchObject({ textTransform: 'uppercase' })
  })

  it('keeps the header compact, requests a 44pt hit rectangle, and opens the sheet', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a')] }))
    const toggle = header(mounted)
    const style = styleOf(toggle)
    expect(style.minHeight).toBe(36)
    expect(toggle.props.hitSlop).toBe(4)
    // Requested geometry only: the native parent can bound hitSlop.
    expect(Number(style.minHeight) + 2 * toggle.props.hitSlop).toBe(44)
    expect(style.height).toBeUndefined()
    expect(style.maxHeight).toBeUndefined()
    expect(sheetTitles(mounted)).toHaveLength(0)
    expand(mounted)
    expect(sheetTitles(mounted)).toHaveLength(1)
  })

  it('uses compact rows and Stop controls with tight group spacing', () => {
    const mounted = mount(
      tasksFor({ state: 'monitoring', supportsTaskStop: true, children: [view('a'), view('b')] })
    )
    expand(mounted)
    const rows = mounted.root.findAll((node) => node.props.testID === 'background-task-row')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.type).toBe('View')
      expect(row.props.hitSlop).toBeUndefined()
      expect(styleOf(row).minHeight).toBe(32)
    }
    const stops = stopButtons(mounted)
    expect(stops).toHaveLength(2)
    for (const stop of stops) {
      const style = styleOf(stop)
      expect(style).toMatchObject({ minHeight: 32, minWidth: 44 })
      expect(stop.props.hitSlop).toBe(6)
      expect(Number(style.minHeight) + 2 * stop.props.hitSlop).toBe(44)
    }
    const label = mounted.root.find(
      (node) => String(node.type) === 'Text' && node.props.children === 'Agents'
    )
    expect(label.parent?.props.style).toMatchObject({ paddingTop: 12, paddingBottom: 4 })
    expect(styleOf(label)).toMatchObject({
      fontSize: 10,
      fontFamily: 'monospace',
      textTransform: 'uppercase'
    })
  })

  it('stops one row by its provider id and holds its button while the Stop is on its way', async () => {
    let finish: () => void = () => {}
    const stop = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const mounted = mount(
      tasksFor(
        {
          state: 'monitoring',
          supportsTaskStop: true,
          children: [view('a'), view('b', { stoppable: false })]
        },
        { stop }
      )
    )
    expand(mounted)
    const buttons = stopButtons(mounted)
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Stop review a'])
    act(() => buttons[0]!.props.onPress())
    act(() => buttons[0]!.props.onPress())
    expect(stop).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledWith('task-a')
    expect(stopButtons(mounted)[0]!.props.disabled).toBe(true)
    await act(async () => finish())
    expect(stopButtons(mounted)[0]!.props.disabled).toBe(false)
  })

  it('offers Stop all only to a host with no per-row stop that still accepts one', async () => {
    let finish: () => void = () => {}
    const stop = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const fallback = mount(tasksFor({ state: 'monitoring', children: [view('a')] }, { stop }))
    expand(fallback)
    expect(stopButtons(fallback).map((button) => button.props.accessibilityLabel)).toEqual([
      'Stop background tasks'
    ])
    const button = stopButtons(fallback)[0]!
    expect(styleOf(button)).toMatchObject({ minHeight: 32, minWidth: 44 })
    expect(button.props.hitSlop).toBe(6)
    expect(Number(styleOf(button).minHeight) + 2 * button.props.hitSlop).toBe(44)
    act(() => button.props.onPress())
    act(() => button.props.onPress())
    expect(stop).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledWith(undefined)
    expect(stopButtons(fallback)[0]!.props.disabled).toBe(true)
    await act(async () => finish())
    expect(stopButtons(fallback)[0]!.props.disabled).toBe(false)
    const none = mount(
      tasksFor({ state: 'monitoring', supportsStopAll: false, children: [view('a')] })
    )
    expand(none)
    expect(stopButtons(none)).toEqual([])
  })

  it("reads an older host's task roster when it publishes no child views", () => {
    const mounted = mount(
      tasksFor({
        state: 'monitoring',
        tasks: [
          { id: 'a', kind: 'agent', state: 'working', startedAt: NOW - 1_000 },
          { id: 'b', kind: 'agent', state: 'waiting', startedAt: NOW - 1_000 }
        ]
      })
    )
    expect(header(mounted).props.accessibilityLabel).toBe('Show background work, Working, 2 agents')
    expand(mounted)
    expect(
      mounted.root.findAll((node) => node.props.testID === 'background-task-row').map(textOf)
    ).toEqual(['Background agent1s', 'Background agent · needs approval1s'])
  })

  it('keeps shell work in a Tasks section above the agents', () => {
    const mounted = mount(
      tasksFor({
        state: 'monitoring',
        tasks: [
          { id: 'a', kind: 'agent', state: 'working', startedAt: NOW - 1_000 },
          { id: 'c', kind: 'command', state: 'working', startedAt: NOW - 1_000 }
        ]
      })
    )
    expand(mounted)
    const sectionLabels = mounted.root
      .findAll(
        (node) =>
          String(node.type) === 'Text' &&
          (node.props.children === 'Tasks' || node.props.children === 'Agents')
      )
      .map((node) => node.props.children)
    expect(sectionLabels).toEqual(['Tasks', 'Agents'])
    expect(
      mounted.root.findAll((node) => node.props.testID === 'background-task-row')
    ).toHaveLength(2)
  })

  it("reads elapsed on the host's clock when the phone's runs ahead", () => {
    // The phone is 30 s ahead of the host that stamped the child's start.
    const mounted = mount(
      tasksFor(
        { state: 'monitoring', children: [view('a', { totalTokens: 900 })] },
        { hostClockOffsetMs: 30_000 }
      )
    )
    expand(mounted)
    expect(
      mounted.root.findAll((node) => node.props.testID === 'background-task-row').map(textOf)
    ).toEqual(['review a · Agent900 · 35s'])
  })

  it('claims no live work once the stream is lost', () => {
    const mounted = mount(
      tasksFor({ state: 'monitoring', children: [view('a'), view('b')] }, { streamLive: false })
    )
    expect(header(mounted).props.accessibilityLabel).toBe(
      'Show background work, Status unavailable'
    )
    expand(mounted)
    const dots = mounted.root.findAll((node) => String(node.type) === 'AgentStateDot')
    expect(dots.map((dot) => dot.props.state)).toEqual(['unverifiable', 'unverifiable'])
    expect(textOf(mounted.root)).toContain('review a · No update in 0m')
  })

  it('closes the sheet through its drawer, and a later roster does not bring it back', () => {
    const working = { state: 'monitoring' as const, children: [view('a')] }
    const mounted = mount(tasksFor(working))
    expand(mounted)
    expect(sheetTitles(mounted)).toHaveLength(1)
    act(() => drawerOf(mounted).props.onClose())
    expect(sheetTitles(mounted)).toHaveLength(0)
    rerender(mounted, null)
    rerender(mounted, working)
    expect(
      mounted.root.findAll((node) => node.props.testID === 'background-tasks-strip')
    ).toHaveLength(1)
    expect(sheetTitles(mounted)).toHaveLength(0)
  })

  it('keeps the sheet open across a roster that empties between children', () => {
    // A sequential fan-out empties the roster between its children; the open sheet waits for the next.
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a')] }))
    expand(mounted)
    rerender(mounted, null)
    expect(sheetTitles(mounted)).toHaveLength(0)
    rerender(mounted, { state: 'monitoring', children: [view('b')] })
    expect(sheetTitles(mounted)).toHaveLength(1)
  })

  function rerender(
    mounted: ReactTestRenderer,
    state: AgentSessionBackgroundTaskState | null,
    options: Parameters<typeof tasksFor>[1] = {}
  ) {
    act(() => {
      mounted.update(
        createElement(MobileNativeChatBackgroundTasks, { tasks: tasksFor(state, options) })
      )
    })
  }

  function finishedToggle(mounted: ReactTestRenderer): ReactTestInstance | undefined {
    return mounted.root.findAll(
      (node) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Finished')
    )[0]
  }

  function rowTexts(mounted: ReactTestRenderer): string[] {
    return mounted.root.findAll((node) => node.props.testID === 'background-task-row').map(textOf)
  }

  it('moves a child that left a live roster under a collapsed Finished section', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a'), view('b')] }))
    expand(mounted)

    rerender(mounted, { state: 'monitoring', children: [view('b')] })

    expect(rowTexts(mounted)).toEqual(['review b · Agent1m 5s'])
    expect(finishedToggle(mounted)?.props.accessibilityLabel).toBe('Finished, 1')

    act(() => finishedToggle(mounted)!.props.onPress())

    expect(rowTexts(mounted)[0]).toBe('review b · Agent1m 5s')
    expect(rowTexts(mounted)[1]).toMatch(/^review a · Ended/)
  })

  it('finishes nothing when the roster reads empty because the stream was lost', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a'), view('b')] }))
    expand(mounted)

    rerender(mounted, { state: 'monitoring', children: [view('b')] }, { streamLive: false })

    expect(finishedToggle(mounted)).toBeUndefined()
  })

  function emptyNotes(mounted: ReactTestRenderer): string[] {
    return mounted.root
      .findAll((node) => String(node.type) === 'Text' && EMPTY_NOTES.includes(node.props.children))
      .map(textOf)
  }

  function settledChild(id: string, settledAt: number): AgentChildWorkView {
    return view(id, { state: 'done', membership: 'settled', settledAt, observedAt: settledAt })
  }

  it('says no background work runs beside a plain working turn', () => {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileNativeChatBackgroundTasks, { tasks: tasksFor(null), working: true })
      )
    })
    expand(mounted)
    expect(emptyNotes(mounted)).toEqual(['No background work is running.'])
  })

  it('shows no empty note while finished work lists, even with nothing running', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a')] }))
    act(() => {
      mounted.update(
        createElement(MobileNativeChatBackgroundTasks, { tasks: tasksFor(null), working: true })
      )
    })
    expand(mounted)
    expect(finishedToggle(mounted)?.props.accessibilityLabel).toBe('Finished, 1')
    expect(emptyNotes(mounted)).toEqual([])
  })

  it('keeps a finished child under Finished across a remount', () => {
    const mounted = mount(tasksFor({ state: 'monitoring', children: [view('a'), view('b')] }))
    expand(mounted)
    rerender(mounted, { state: 'monitoring', children: [view('b')] })

    const remounted = mount(tasksFor({ state: 'monitoring', children: [view('b')] }))
    expand(remounted)

    expect(finishedToggle(remounted)?.props.accessibilityLabel).toBe('Finished, 1')
  })

  it('lists a child the history says finished before this phone watched it', () => {
    const mounted = mount(
      tasksFor(
        { state: 'monitoring', children: [view('b')] },
        { commandActivity: [settledChild('old', NOW - 9_000)] }
      )
    )
    expand(mounted)
    expect(finishedToggle(mounted)?.props.accessibilityLabel).toBe('Finished, 1')

    act(() => finishedToggle(mounted)!.props.onPress())

    expect(rowTexts(mounted)[1]).toMatch(/^review old · Ended/)
  })

  it('never lists a running child from the history as finished', () => {
    const mounted = mount(
      tasksFor({ state: 'monitoring', children: [view('b')] }, { commandActivity: [view('b')] })
    )
    expand(mounted)
    expect(finishedToggle(mounted)).toBeUndefined()
  })

  function drawerOf(mounted: ReactTestRenderer): ReactTestInstance {
    return mounted.root.find((node) => String(node.type) === 'BottomDrawer')
  }
})
