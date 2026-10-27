import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  buildBackgroundTaskGroups,
  type BackgroundTaskGroup
} from '../../../src/shared/background-task-roster'
import { structuredSessionBackgroundTasksView } from '../../../src/shared/structured-session-background-tasks-view'
import { MobileBackgroundWorkSheet } from './MobileBackgroundWorkSheet'

const NOW = 10_000_000

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Activity: 'Activity',
  Bot: 'Bot',
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

describe('MobileBackgroundWorkSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(groups: readonly BackgroundTaskGroup[]): ReactTestRenderer {
    const view = structuredSessionBackgroundTasksView({ state: 'monitoring' }, null)
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileBackgroundWorkSheet, {
          visible: true,
          onClose: () => {},
          groups,
          view,
          now: NOW,
          hostNow: NOW,
          stopping: { taskIds: new Set<string>(), all: false },
          onStop: () => {}
        })
      )
    })
    return mounted
  }

  function textOf(node: ReactTestInstance): string {
    return node.children
      .map((child) => (typeof child === 'string' ? child : textOf(child)))
      .join('')
  }

  function texts(mounted: ReactTestRenderer): string[] {
    return mounted.root.findAll((node) => String(node.type) === 'Text').map((node) => textOf(node))
  }

  it('says the details are unavailable when its groups carry no rows to show', () => {
    const mounted = render([{ kind: 'command', tasks: [] }])
    expect(texts(mounted)).toContain(say('detailsUnavailable'))
    expect(texts(mounted)).not.toContain('Tasks')
  })

  it('lists work under its section and leaves the unavailable note out', () => {
    const view = structuredSessionBackgroundTasksView(
      {
        state: 'monitoring',
        tasks: [{ id: 'c', kind: 'command', state: 'working', startedAt: NOW - 1_000 }]
      },
      null
    )
    const groups = buildBackgroundTaskGroups(view.tasks, view.settledTasks, say)
    const mounted = render(groups)
    expect(texts(mounted)).toContain('Tasks')
    expect(texts(mounted)).not.toContain(say('detailsUnavailable'))
  })
})
