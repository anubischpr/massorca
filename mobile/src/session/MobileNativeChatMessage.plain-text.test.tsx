import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'

vi.mock('react-native', async () => {
  const React = await import('react')
  const Text = ({ children, ...props }: { children?: ReactNode }): ReactNode =>
    React.createElement('Text', props, children)
  return {
    Image: 'Image',
    Platform: { OS: 'ios' },
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    Text,
    View: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Animated: { Value: class {}, timing: () => ({ start: vi.fn() }) }
  }
})
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }))
vi.mock('lucide-react-native', () => ({
  Bot: 'Bot',
  Brain: 'Brain',
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  SquareChevronRight: 'SquareChevronRight',
  SquareTerminal: 'SquareTerminal',
  Wrench: 'Wrench'
}))
vi.mock('../components/MobileMarkdown', () => ({ MobileMarkdown: 'MobileMarkdown' }))
vi.mock('./MobileNativeChatMessageActionsSheet', () => ({
  MobileNativeChatMessageActionsSheet: 'MessageActionsSheet'
}))
vi.mock('../hooks/use-now', () => ({ useNow: () => 70_000 }))

import { MarkdownPlainTextContext } from '../components/MobileMarkdownPlainText'
import { MobileNativeChatMessage } from './MobileNativeChatMessage'

const PERSON: NativeChatMessage = {
  id: 'person',
  role: 'user',
  blocks: [{ type: 'text', text: 'Hola @Iris' }],
  timestamp: null,
  source: 'transcript'
}

function mark(text: string, key: string): ReactNode[] {
  return [createElement('Mark', { key }, text)]
}

function render(withRenderer: boolean): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    const row = createElement(MobileNativeChatMessage, { message: PERSON })
    renderer = create(
      withRenderer ? createElement(MarkdownPlainTextContext.Provider, { value: mark }, row) : row
    )
  })
  return renderer
}

describe('MobileNativeChatMessage person text with mention chips', () => {
  it('draws a person message through the transcript renderer when one is in context', () => {
    const marks = render(true).root.findAllByType('Mark' as never) as ReactTestInstance[]

    expect(marks.map((node) => node.props.children)).toEqual(['Hola @Iris'])
  })

  it('keeps a person message plain when no renderer is in context', () => {
    expect(render(false).root.findAllByType('Mark' as never)).toEqual([])
  })
})
