import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatChecklistItem } from '../../../src/shared/native-chat-checklist'
import { MobileChecklistItemSheet } from './MobileChecklistItemSheet'

vi.mock('react-native', () => ({
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  Plus: 'Plus'
}))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: ReactNode }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})

const ITEM: NativeChatChecklistItem = {
  key: 'open the summary',
  text: 'Open the summary',
  checked: false,
  by: null,
  at: null,
  note: null,
  noteAt: null,
  screenshots: [],
  unseen: false
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

describe('MobileChecklistItemSheet', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(
    overrides: Partial<Parameters<typeof MobileChecklistItemSheet>[0]> = {}
  ): {
    mounted: ReactTestRenderer
    onSave: ReturnType<typeof vi.fn>
    onClose: ReturnType<typeof vi.fn>
    onPickScreenshot: ReturnType<typeof vi.fn>
  } {
    act(() => renderer?.unmount())
    const onSave = vi.fn(async () => true)
    const onClose = vi.fn()
    const onPickScreenshot = vi.fn(async () => [])
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileChecklistItemSheet, {
          visible: true,
          item: ITEM,
          position: 1,
          total: 2,
          agentLabel: 'Claude',
          readOnly: false,
          onClose,
          onSave,
          onPickScreenshot,
          ...overrides
        })
      )
    })
    return { mounted, onSave, onClose, onPickScreenshot }
  }

  function pressable(mounted: ReactTestRenderer, label: string): ReactTestInstance {
    return mounted.root.find((node) => node.props.accessibilityLabel === label)
  }

  it('captions the item with its place and names the agent that reads it', () => {
    const { mounted } = mount()
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Checklist · item 1 of 2',
        'Open the summary',
        'Claude reads this with your next message.',
        'Note',
        'Screenshot'
      ])
    )
    expect(pressable(mounted, 'Add')).toBeDefined()
  })

  it('saves an edited note alone, so the agent is not told the check changed', async () => {
    const { mounted, onSave } = mount()
    const input = mounted.root.find((node) => String(node.type) === 'TextInput')
    act(() => input.props.onChangeText('Sheet opens from the menu'))
    await act(async () => {
      pressable(mounted, 'Save').props.onPress()
    })
    expect(onSave).toHaveBeenCalledWith({ note: 'Sheet opens from the menu' })
  })

  it('saves a tick as the check, and nothing else when the note and screenshots did not change', async () => {
    const { mounted, onSave } = mount()
    const box = pressable(mounted, 'Checked')
    act(() => box.props.onPress())
    await act(async () => {
      pressable(mounted, 'Save').props.onPress()
    })
    expect(onSave).toHaveBeenCalledWith({ checked: true })
  })

  it('closes without saving when nothing changed', async () => {
    const { mounted, onSave, onClose } = mount()
    await act(async () => {
      pressable(mounted, 'Save').props.onPress()
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('adds a picked screenshot as a tile, and the save carries it', async () => {
    const picked = { path: '/var/tmp/clipboard-7.png', name: 'clipboard-7.png', previewUri: 'file:///p.png' }
    const onPickScreenshot = vi.fn(async () => [picked])
    const { mounted, onSave } = mount({ onPickScreenshot })
    await act(async () => {
      pressable(mounted, 'Add').props.onPress()
    })
    expect(onPickScreenshot).toHaveBeenCalledTimes(1)
    // A picked screenshot previews as an image tile, named for its file.
    const tiles = mounted.root.findAll((node) => String(node.type) === 'Image')
    expect(tiles.map((tile) => tile.props.accessibilityLabel)).toEqual(['clipboard-7.png'])
    await act(async () => {
      pressable(mounted, 'Save').props.onPress()
    })
    expect(onSave).toHaveBeenCalledWith({
      screenshots: [{ path: '/var/tmp/clipboard-7.png', name: 'clipboard-7.png' }]
    })
  })

  it('shows read-only: no Add tile, no agent line, and Save disabled', () => {
    const { mounted } = mount({ readOnly: true })
    expect(mounted.root.findAll((node) => node.props.accessibilityLabel === 'Add')).toEqual([])
    const texts = mounted.root.findAll((node) => String(node.type) === 'Text').map(textOf)
    expect(texts).not.toContain('Claude reads this with your next message.')
    expect(pressable(mounted, 'Save').props.disabled).toBe(true)
  })
})
