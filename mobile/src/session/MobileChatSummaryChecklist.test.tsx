import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileChatSummaryChecklist } from './MobileChatSummaryChecklist'
import type {
  MobileNativeChatChecklist,
  MobileNativeChatChecklistView
} from './use-mobile-native-chat-checklist'

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
vi.mock('./MobileNativeChatChecklistSheets', () => ({
  MobileNativeChatChecklistItemSheet: () => null
}))
vi.mock('./MobilePlanSheet', () => ({
  MobilePlanSheet: () => null
}))

const CHECKLIST: MobileNativeChatChecklist = {
  title: 'QA preview',
  checked: 1,
  unseen: 0,
  items: [
    {
      key: 'open the summary',
      text: 'Open the summary',
      source: 'agent',
      checked: true,
      by: 'person',
      at: null,
      note: null,
      noteAt: null,
      screenshots: [],
      unseen: false
    },
    {
      key: 'check the banner',
      text: 'Check the banner',
      source: 'person',
      checked: false,
      by: null,
      at: null,
      note: null,
      noteAt: null,
      screenshots: [],
      unseen: false,
      addedAt: null
    }
  ]
}

function viewWith(checklist: MobileNativeChatChecklist | null): MobileNativeChatChecklistView {
  return {
    checklist,
    writtenAt: null,
    readOnly: false,
    listOpen: false,
    activeKey: null,
    itemOpenCount: 0,
    openList: vi.fn(),
    closeList: vi.fn(),
    openItem: vi.fn(),
    closeItem: vi.fn(),
    toggleItem: vi.fn(async () => true),
    saveItem: vi.fn(async () => true),
    addItem: vi.fn(async () => true),
    removeItem: vi.fn(async () => true),
    pickScreenshot: vi.fn(async () => [])
  }
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileChatSummaryChecklist', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(checklist: MobileNativeChatChecklist | null): ReactTestRenderer {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileChatSummaryChecklist, {
          plan: null,
          view: viewWith(checklist),
          agentLabel: 'Claude'
        })
      )
    })
    return mounted
  }

  it('shows the Checklist section with an empty line when the chat has no items yet', () => {
    const mounted = mount(null)
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(expect.arrayContaining(['Checklist', 'No checklist yet.']))
    expect(texts.some((text) => /\d+\/\d+/.test(text))).toBe(false)
  })

  it('shows the checked count and the items once the chat has some', () => {
    const mounted = mount(CHECKLIST)
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(expect.arrayContaining(['Checklist', '1/2']))
    expect(texts).not.toContain('No checklist yet.')
    expect(
      mounted.root.findAll((node) => node.props.accessibilityLabel === 'Check the banner').length
    ).toBeGreaterThan(0)
  })
})
