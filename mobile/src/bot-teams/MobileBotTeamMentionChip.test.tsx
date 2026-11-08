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
vi.mock('lucide-react-native', () => ({ Plug: 'Plug' }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'RepoIcon' }))
vi.mock('../components/MobileFileTypeIcon', () => ({ MobileFileTypeIcon: 'FileTypeIcon' }))

const LOGO = { type: 'emoji' as const, emoji: '🚀' }
const TARGETS: MobileBotTeamMentionTarget[] = [
  { name: 'Iris', kind: 'bot', agent: 'claude', character: null },
  { name: 'Warehouse', kind: 'team', agent: null, character: 'square' },
  { name: 'Launch', kind: 'project', agent: null, character: null, logo: LOGO },
  { name: 'Launchpad', kind: 'project', agent: null, character: null, logo: null },
  { name: 'Engram', kind: 'app', agent: null, character: null }
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
  it('draws a known bot mention as a chip with its agent icon and name', () => {
    const renderer = renderMentions('Hola @Iris, mira')

    expect(chipsOf(renderer).map((chip) => chip.props.label)).toEqual(['Iris'])
    expect(chipsOf(renderer)[0].props.icon.type).toBe('AgentIcon')
    expect(shownText(renderer)).toBe('Hola Iris, mira')
  })

  it('draws a known team mention as a chip with its character icon', () => {
    const renderer = renderMentions('Pásalo a @Warehouse.')

    expect(chipsOf(renderer).map((chip) => chip.props.label)).toEqual(['Warehouse'])
    expect(chipsOf(renderer)[0].props.icon.type).toBe('CharacterIcon')
    expect(shownText(renderer)).toBe('Pásalo a Warehouse.')
  })

  it('draws a project with a logo as a chip with that logo', () => {
    const chip = chipsOf(renderMentions('mira @Launch'))[0]

    expect(chip.props.label).toBe('Launch')
    expect(chip.props.icon.type).toBe('RepoIcon')
    expect(chip.props.icon.props.repoIcon).toEqual(LOGO)
  })

  it('draws a project without a logo as a chip with no icon', () => {
    const chip = chipsOf(renderMentions('mira @Launchpad'))[0]

    expect(chip.props.label).toBe('Launchpad')
    expect(chip.props.icon).toBeNull()
  })

  it('draws a connected app as a chip with the app icon', () => {
    const chip = chipsOf(renderMentions('usa @Engram'))[0]

    expect(chip.props.label).toBe('Engram')
    expect(chip.props.icon.type).toBe('Plug')
  })

  it('draws a sent @path.ext as a chip with its file-type icon and the path as label', () => {
    const renderer = renderMentions('ve @site/flyer.html ya')
    const chip = chipsOf(renderer)[0]

    expect(chip.props.label).toBe('site/flyer.html')
    expect(chip.props.icon.type).toBe('FileTypeIcon')
    expect(chip.props.icon.props.path).toBe('site/flyer.html')
    expect(shownText(renderer)).toBe('ve site/flyer.html ya')
  })

  it('keeps an unknown @name plain, with no chip', () => {
    expect(botTeamMentionNodes('hola @Nadie', 'k', TARGETS)).toBeNull()
    expect(chipsOf(renderMentions('hola @Nadie'))).toEqual([])
  })

  it('keeps every chip and plain run in the order the text has them', () => {
    const renderer = renderMentions('@Iris y @Warehouse ya')

    expect(chipsOf(renderer).map((chip) => chip.props.label)).toEqual(['Iris', 'Warehouse'])
    expect(shownText(renderer)).toBe('Iris y Warehouse ya')
  })
})
