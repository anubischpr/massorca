import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatTaskList } from '../../../src/shared/native-chat-task-list'
import { MobilePlanSheet } from './MobilePlanSheet'

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Circle: 'Circle',
  CircleCheck: 'CircleCheck',
  CircleDot: 'CircleDot'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: unknown }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})

const PLAN: NativeChatTaskList = {
  explanation: 'Ship the sheet first',
  tasks: [
    { content: 'Read the spec', status: 'completed' },
    { content: 'Write the code', status: 'in_progress', activeForm: 'Writing the code' },
    { content: 'Run the tests', status: 'pending' }
  ]
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobilePlanSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(plan: NativeChatTaskList | null, visible = true): ReactTestRenderer {
    act(() => renderer?.unmount())
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobilePlanSheet, { visible, plan, onClose: () => undefined }))
    })
    return mounted
  }

  it('draws nothing while closed', () => {
    expect(mount(PLAN, false).toJSON()).toBeNull()
  })

  it('reports the completed count on a progress bar that matches it', () => {
    const mounted = mount(PLAN)
    expect(mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)).toContain(
      '1 of 3 done'
    )
    const bar = mounted.root.find((node) => node.props.accessibilityRole === 'progressbar')
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 3, now: 1 })
    const fill = mounted.root.find(
      (node) =>
        String(node.type) === 'View' &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (part: unknown) => typeof part === 'object' && part !== null && 'width' in part
        )
    )
    expect(fill.props.style).toContainEqual({ width: '33%' })
  })

  it('lists the steps in plan order, showing the active form for the running step', () => {
    const steps = mount(PLAN)
      .root.findAll((node) => String(node.type) === 'Text' && node.props.numberOfLines === 3)
      .map(textOf)
    expect(steps).toEqual(['Read the spec', 'Writing the code', 'Run the tests'])
  })

  it('shows the plan explanation above the steps', () => {
    const texts = mount(PLAN)
      .root.findAll((node) => String(node.type) === 'Text')
      .map(textOf)
    expect(texts).toContain('Ship the sheet first')
  })
})
