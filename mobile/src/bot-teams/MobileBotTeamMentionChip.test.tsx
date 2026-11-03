import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { BotTeamMentionChip, botTeamMentionNodes } from './MobileBotTeamMentionChip'
import type { MobileBotTeamMentionTarget } from './mobile-bot-team-mention'

vi.mock('react-native', async () => {
  const React = await import('react')
  return {
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('Text', props, children),
    View: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children)
  }
})
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))

const TARGETS: MobileBotTeamMentionTarget[] = [
  { name: 'Iris', kind: 'bot', agent: 'claude', character: null },
  { name: 'Warehouse', kind: 'team', agent: null, character: 'square' }
]

function renderMentions(text: string): ReactTestRenderer {
  const nodes = botTeamMentionNodes(text, 'k', TARGETS) ?? text
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement('Text', null, nodes))
  })
  return renderer
}

/** The plain text a rendered tree shows, with chip labels included. */
function shownText(renderer: ReactTestRenderer): string {
  const walk = (node: unknown): string => {
    if (typeof node === 'string') {
      return node
    }
    if (node && typeof node === 'object' && 'children' in node) {
      const children = (node as { children: unknown[] | null }).children ?? []
      return children.map(walk).join('')
    }
    return ''
  }
  return walk(renderer.toJSON())
}

function chipsOf(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll((node) => node.type === BotTeamMentionChip)
}

describe('botTeamMentionNodes', () => {
  it('draws a known bot mention as a chip carrying that bot', () => {
    const renderer = renderMentions('Hola @Iris, mira')

    expect(chipsOf(renderer).map((chip) => chip.props.target.name)).toEqual(['Iris'])
    expect(shownText(renderer)).toBe('Hola @Iris, mira')
  })

  it('draws a known team mention as a chip carrying that team', () => {
    const renderer = renderMentions('Pásalo a @Warehouse.')

    expect(chipsOf(renderer).map((chip) => chip.props.target.kind)).toEqual(['team'])
    expect(shownText(renderer)).toBe('Pásalo a @Warehouse.')
  })

  it('keeps an unknown @name plain, with no chip', () => {
    expect(botTeamMentionNodes('hola @Nadie', 'k', TARGETS)).toBeNull()
    expect(chipsOf(renderMentions('hola @Nadie'))).toEqual([])
  })

  it('keeps every chip and plain run in the order the text has them', () => {
    const renderer = renderMentions('@Iris y @Warehouse ya')

    expect(chipsOf(renderer).map((chip) => chip.props.target.name)).toEqual(['Iris', 'Warehouse'])
    expect(shownText(renderer)).toBe('@Iris y @Warehouse ya')
  })
})
