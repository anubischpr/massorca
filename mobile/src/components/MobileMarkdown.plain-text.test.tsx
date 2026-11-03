import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileMarkdown } from './MobileMarkdown'
import { MarkdownPlainTextContext } from './MobileMarkdownPlainText'

vi.mock('react-native', () => ({
  Linking: { openURL: () => Promise.resolve() },
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('./pr-sidebar/MermaidDiagram', () => ({ MermaidDiagram: 'MermaidDiagram' }))

/** Stands in for a chip: marks each plain run the markdown hands to the room's renderer. */
function markRuns(text: string, key: string): ReactNode[] | null {
  return text.includes('@Iris') ? [createElement('Mark', { key }, text)] : null
}

function renderMarkdown(content: string, withRenderer: boolean): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    const markdown = createElement(MobileMarkdown, { content })
    renderer = create(
      withRenderer
        ? createElement(MarkdownPlainTextContext.Provider, { value: markRuns }, markdown)
        : markdown
    )
  })
  return renderer
}

describe('MobileMarkdown plain-text extension', () => {
  it('draws the plain runs it is given through the renderer from context', () => {
    const renderer = renderMarkdown('Hola @Iris, mira', true)

    const marks = renderer.root.findAllByType('Mark' as never) as ReactTestInstance[]
    expect(marks.map((mark) => mark.props.children)).toEqual(['Hola @Iris, mira'])
  })

  it('leaves code spans alone, so a mention inside backticks is not drawn as a chip', () => {
    const renderer = renderMarkdown('Usa `@Iris` aquí', true)

    expect(renderer.root.findAllByType('Mark' as never)).toEqual([])
  })

  it('renders plain text as before when no renderer is in context', () => {
    const renderer = renderMarkdown('Hola @Iris, mira', false)

    expect(renderer.root.findAllByType('Mark' as never)).toEqual([])
  })
})
