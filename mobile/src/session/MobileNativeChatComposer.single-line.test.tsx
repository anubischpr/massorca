import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileNativeChatComposer } from './MobileNativeChatComposer'

vi.mock('react-native', async () => {
  const React = await import('react')
  return {
    ActivityIndicator: 'ActivityIndicator',
    Image: 'Image',
    Keyboard: { dismiss: vi.fn() },
    Pressable: 'Pressable',
    ScrollView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement('ScrollView', props, children),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: 'Text',
    TextInput: 'TextInput',
    View: 'View'
  }
})

vi.mock('lucide-react-native', () => ({
  ArrowUp: 'ArrowUp',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Eye: 'Eye',
  ImagePlus: 'ImagePlus',
  Lock: 'Lock',
  LockKeyhole: 'LockKeyhole',
  LockOpen: 'LockOpen',
  Mic: 'Mic',
  NotebookPen: 'NotebookPen',
  Plus: 'Plus',
  Square: 'Square',
  X: 'X',
  Zap: 'Zap'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: 'MobileAgentIcon' }))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: unknown }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})

type Props = ComponentProps<typeof MobileNativeChatComposer>

function renderComposer(props: Partial<Props> = {}): ReactTestRenderer {
  let root!: ReactTestRenderer
  act(() => {
    root = create(
      createElement(MobileNativeChatComposer, {
        value: '',
        onChangeText: vi.fn(),
        onSend: vi.fn(async () => true),
        sendSurfaceId: 'surface',
        getSendCompletionGeneration: () => 0,
        getComposerEditGeneration: () => 0,
        ...props
      })
    )
  })
  return root
}

/** A short label per direct child of a host node, in order. */
function childLabels(parent: { children: unknown[] }): string[] {
  return parent.children.map((child) => {
    if (typeof child === 'string') {
      return child
    }
    const node = child as { type: string; props: Record<string, unknown> }
    if (node.type === 'TextInput') {
      return 'TextInput'
    }
    if (node.props.testID === 'native-chat-composer-actions') {
      return 'actions'
    }
    return String(node.props.accessibilityLabel ?? node.type)
  })
}

function bar(root: ReactTestRenderer) {
  return root.root.findByProps({ testID: 'native-chat-composer' })
}

describe('MobileNativeChatComposer single-line layout', () => {
  it('puts the attach button left of the input and send right of it', () => {
    const root = renderComposer({ layout: 'single-line', onAttachFile: vi.fn() })

    expect(childLabels(bar(root))).toEqual(['Attach file', 'TextInput', 'Send message'])
  })

  it('shows no attach button when the room cannot attach files', () => {
    const root = renderComposer({ layout: 'single-line' })

    expect(childLabels(bar(root))).toEqual(['TextInput', 'Send message'])
  })

  it('keeps the input multiline with no fixed line count, so it grows as the person types', () => {
    const root = renderComposer({ layout: 'single-line', onAttachFile: vi.fn() })
    const input = root.root.findByType('TextInput')

    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBeUndefined()
  })

  it('calls onAttachFile when the attach button is pressed', () => {
    const onAttachFile = vi.fn()
    const root = renderComposer({ layout: 'single-line', onAttachFile })

    root.root.findByProps({ accessibilityLabel: 'Attach file' }).props.onPress()

    expect(onAttachFile).toHaveBeenCalledTimes(1)
  })
})

describe('MobileNativeChatComposer default layout (Workspaces) is unchanged', () => {
  it('keeps the input row above an action row holding attach, dictate and send', () => {
    const root = renderComposer({ onAttachImage: vi.fn(), onMicPress: vi.fn() })

    expect(childLabels(bar(root))).toEqual(['TextInput', 'actions'])
    const actions = root.root.findByProps({ testID: 'native-chat-composer-actions' })
    expect(childLabels(actions).filter((label) => label !== 'View')).toEqual([
      'Attach image',
      'Dictate',
      'Send message'
    ])
  })

  it('never shows the single-line attach button without the layout prop', () => {
    const root = renderComposer({ onAttachFile: vi.fn() })

    expect(root.root.findAll((node) => node.props.accessibilityLabel === 'Attach file')).toEqual([])
  })
})
