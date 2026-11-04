import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileNativeChatChecklistChip } from './MobileNativeChatChecklistChip'
import { MobileNativeChatChecklistRow } from './MobileNativeChatChecklistRow'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  ListChecks: 'ListChecks'
}))

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileNativeChatChecklistRow', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('replaces the fence with one row: the label, the title, the count and a chevron, and opens the sheet', () => {
    const onPress = vi.fn()
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileNativeChatChecklistRow, {
          title: 'QA preview',
          checked: 2,
          total: 5,
          onPress
        })
      )
    })
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(['Checklist', 'QA preview', '2/5'])
    const row = mounted.root.find((node) => node.props.accessibilityLabel === 'Checklist' && String(node.type) === 'Pressable')
    act(() => row.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('MobileNativeChatChecklistChip', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('shows the host update as a chip, and opens it to the block text', () => {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileNativeChatChecklistChip, { update: 'Checklist "QA": changes' }))
    })
    const chip = mounted.root.find((node) => node.props.accessibilityLabel === 'Checklist changes')
    expect(chip.props.accessibilityState).toEqual({ expanded: false })
    expect(mounted.root.findAll((node) => node.props.selectable === true)).toEqual([])
    act(() => chip.props.onPress())
    const opened = mounted.root.find((node) => node.props.accessibilityLabel === 'Checklist changes')
    expect(opened.props.accessibilityState).toEqual({ expanded: true })
    const body = mounted.root.find((node) => node.props.selectable === true)
    expect(textOf(body)).toBe('Checklist "QA": changes')
  })
})
