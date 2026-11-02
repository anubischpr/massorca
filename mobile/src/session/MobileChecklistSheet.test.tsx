import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatChecklist } from '../../../src/shared/native-chat-checklist'
import { MobileChecklistSheet } from './MobileChecklistSheet'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronRight: 'ChevronRight'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: ReactNode }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})

const AT = new Date(2026, 10, 2, 13, 52).getTime()
const PERSON_AT = new Date(2026, 10, 2, 14, 2).getTime()

const CHECKLIST: NativeChatChecklist = {
  title: 'QA preview',
  checked: 1,
  unseen: 1,
  items: [
    {
      key: 'open the summary',
      text: 'Open the summary',
      checked: true,
      by: 'person',
      at: PERSON_AT,
      note: 'Sheet opens from the menu',
      noteAt: PERSON_AT,
      screenshots: [{ path: '/tmp/shot.png', name: 'shot.png' }],
      unseen: true
    },
    {
      key: 'plan shows',
      text: 'Plan shows',
      checked: false,
      by: null,
      at: null,
      note: null,
      noteAt: null,
      screenshots: [],
      unseen: false
    }
  ]
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileChecklistSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(
    overrides: Partial<Parameters<typeof MobileChecklistSheet>[0]> = {}
  ): { mounted: ReactTestRenderer; onToggle: ReturnType<typeof vi.fn>; onSendNow: ReturnType<typeof vi.fn> } {
    act(() => renderer?.unmount())
    const onToggle = vi.fn()
    const onSendNow = vi.fn()
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileChecklistSheet, {
          visible: true,
          checklist: CHECKLIST,
          writtenAt: AT,
          agentLabel: 'Claude',
          readOnly: false,
          onClose: () => undefined,
          onToggle,
          onOpenItem: () => undefined,
          onSendNow,
          ...overrides
        })
      )
    })
    return { mounted, onToggle, onSendNow }
  }

  it('draws nothing while closed', () => {
    expect(mount({ visible: false }).mounted.toJSON()).toBeNull()
  })

  it('shows the count, a progress bar, and the title with the agent and the clock it last wrote', () => {
    const { mounted } = mount()
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Checklist',
        '1 of 2 checked',
        'QA preview · from Claude, 13:52',
        'Items'
      ])
    )
    const bar = mounted.root.find((node) => node.props.accessibilityRole === 'progressbar')
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 2, now: 1 })
  })

  it('lists each item with who checked it, its note and screenshots, and no meta where nobody has', () => {
    const { mounted } = mount()
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Open the summary',
        'You · 14:02 · Note · 1 screenshot',
        'Sheet opens from the menu',
        'Plan shows'
      ])
    )
  })

  it('ticks an item through onToggle when its checkbox is pressed', () => {
    const { mounted, onToggle } = mount()
    const boxes = mounted.root.findAll((node) => node.props.accessibilityRole === 'checkbox')
    act(() => boxes[1]?.props.onPress())
    expect(onToggle).toHaveBeenCalledWith(CHECKLIST.items[1])
  })

  it('shows the unseen footer with the board copy and a Send now button that sends', () => {
    const { mounted, onSendNow } = mount()
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toContain('1 change the agent has not seen. It goes with your next message.')
    const send = mounted.root.find((node) => node.props.accessibilityLabel === 'Send now')
    act(() => send.props.onPress())
    expect(onSendNow).toHaveBeenCalledTimes(1)
  })

  it('leaves out the footer when every change has been sent', () => {
    const { mounted } = mount({ checklist: { ...CHECKLIST, unseen: 0 } })
    expect(
      mounted.root.findAll((node) => node.props.accessibilityLabel === 'Send now')
    ).toEqual([])
  })

  it('shows read-only when the host cannot take the marks: boxes disabled and the update line', () => {
    const { mounted } = mount({ readOnly: true })
    const boxes = mounted.root.findAll((node) => node.props.accessibilityRole === 'checkbox')
    expect(boxes.every((box) => box.props.disabled === true)).toBe(true)
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toContain('Update the host to check items here.')
  })
})
