import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeamRequestChoice } from '../../../src/shared/bot-team-request-choice'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamRequestChoice } from './MobileBotTeamRequestChoice'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    { ...BOT, id: 'iris', name: 'Iris', job: 'Flyers', agent: 'claude' },
    { ...BOT, id: 'max', name: 'Max', job: 'Charts', agent: 'claude' }
  ]
}

function renderChoice(choice: BotTeamRequestChoice): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      createElement(MobileBotTeamRequestChoice, {
        choice,
        team: TEAM,
        otherTeams: [],
        busy: false,
        onSendToBot: vi.fn(),
        onSendToTeam: vi.fn(),
        onKeep: vi.fn(),
        onCreateBot: vi.fn(),
        onCreateTeam: vi.fn()
      })
    )
  })
  return renderer
}

/** The text of each bot row that is picked. */
function pickedRows(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'radio' && node.props.accessibilityState?.selected === true
    )
    .map((node) =>
      node
        .findAll((child) => typeof child.props.children === 'string')
        .map((child) => String(child.props.children))
        .join(' ')
    )
}

describe('MobileBotTeamRequestChoice', () => {
  it('picks the bot the host suggests first, and sends to it', () => {
    const renderer = renderChoice({ kind: 'new-bot', suggestedBotId: 'max' })

    expect(renderer.root.findByProps({ accessibilityLabel: 'Send to Max' })).toBeDefined()
    expect(pickedRows(renderer)).toHaveLength(1)
    expect(pickedRows(renderer)[0]).toContain('Max')
  })

  it('picks the first bot of the team when the host suggests none', () => {
    const renderer = renderChoice({ kind: 'new-bot' })

    expect(renderer.root.findByProps({ accessibilityLabel: 'Send to Iris' })).toBeDefined()
  })

  it('picks the bot of the answer it is given when a new question replaces the last one', () => {
    const renderer = renderChoice({ kind: 'new-bot', suggestedBotId: 'max' })
    act(() => {
      renderer.update(
        createElement(MobileBotTeamRequestChoice, {
          choice: { kind: 'new-bot', suggestedBotId: 'iris' },
          team: TEAM,
          otherTeams: [],
          busy: false,
          onSendToBot: vi.fn(),
          onSendToTeam: vi.fn(),
          onKeep: vi.fn(),
          onCreateBot: vi.fn(),
          onCreateTeam: vi.fn()
        })
      )
    })

    expect(renderer.root.findByProps({ accessibilityLabel: 'Send to Iris' })).toBeDefined()
  })
})
