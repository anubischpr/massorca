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

describe('MobileBackgroundWorkSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(
    groups: readonly BackgroundTaskGroup[],
    extra: Partial<Parameters<typeof MobileBackgroundWorkSheet>[0]> = {}
  ): ReactTestRenderer {
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
          onStop: () => {},
          ...extra
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

  describe('finished work', () => {
    const finishedView = structuredSessionBackgroundTasksView(
      {
        state: 'monitoring',
        tasks: [
          {
            id: 'old',
            kind: 'agent',
            state: 'done',
            description: 'review old',
            startedAt: NOW - 90_000
          }
        ]
      },
      null
    )
    const finishedGroups = buildBackgroundTaskGroups(
      [],
      finishedView.tasks.map((task) => task),
      say
    )

    function finishedToggle(mounted: ReactTestRenderer): ReactTestInstance | undefined {
      return mounted.root.findAll(
        (node) =>
          String(node.type) === 'Pressable' &&
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('Finished')
      )[0]
    }

    function rows(mounted: ReactTestRenderer): number {
      return mounted.root.findAll((node) => node.props.testID === 'background-task-row').length
    }

    it('offers no Finished section when nothing finished', () => {
      expect(finishedToggle(render([{ kind: 'command', tasks: [] }]))).toBeUndefined()
    })

    it('collapses finished rows until the section is opened, then closes them again', () => {
      const mounted = render([], { finished: finishedGroups })
      const toggle = finishedToggle(mounted)!
      expect(toggle.props.accessibilityLabel).toBe('Finished, 1')
      expect(rows(mounted)).toBe(0)

      act(() => toggle.props.onPress())
      expect(rows(mounted)).toBe(1)
      expect(
        mounted.root
          .findAll((node) => node.props.testID === 'background-task-row')
          .map((node) => textOf(node))[0]
      ).toContain('review old')
      // A finished row offers no Stop, whatever the host supports.
      expect(
        mounted.root.findAll(
          (node) =>
            String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Stop review old'
        )
      ).toHaveLength(0)

      act(() => finishedToggle(mounted)!.props.onPress())
      expect(rows(mounted)).toBe(0)
    })

    it('says its own note, not the unavailable line, when nothing running lists', () => {
      const mounted = render([], { emptyNote: 'No background work is running.' })
      expect(texts(mounted)).toContain('No background work is running.')
      expect(texts(mounted)).not.toContain(say('detailsUnavailable'))
    })
  })
})
