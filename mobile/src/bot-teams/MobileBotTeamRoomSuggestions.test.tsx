import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { removeBotTeamMentionBeforeCaret } from '../../../src/shared/bot-team-mention-text'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import {
  applyAutocomplete,
  detectAutocompleteTrigger
} from '../session/mobile-native-chat-autocomplete'
import { BotTeamMentionChip, botTeamMentionNodes } from './MobileBotTeamMentionChip'
import { botTeamMentionTargets } from './mobile-bot-team-mention'
import { botTeamRoomSuggestions } from './MobileBotTeamRoomSuggestions'

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
vi.mock('lucide-react-native', () => ({ FileText: 'FileText' }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))

const BOT = {
  id: 'iris',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}

function team(
  id: string,
  name: string,
  character: BotTeam['character'],
  bots: BotTeam['bots']
): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'full-access',
    bots
  }
}

const ROOM = team('team', 'Marketing', 'circle', [BOT])
const WAREHOUSE = team('team_2', 'Warehouse', 'square', [{ ...BOT, id: 'max', name: 'Max' }])
const TARGETS = botTeamMentionTargets(ROOM, [ROOM, WAREHOUSE])

/** What the composer does on a tap: the trigger span takes the suggestion's insert, then a space. */
function tapSuggestion(text: string, label: string): { text: string; cursor: number } {
  const trigger = detectAutocompleteTrigger(text, text.length)
  const suggestion = (
    botTeamRoomSuggestions({
      text,
      caret: text.length,
      team: ROOM,
      otherTeams: [WAREHOUSE],
      files: ['flyer.md']
    }) ?? []
  ).find((item) => item.kind === 'custom' && item.label === label)
  if (!trigger || suggestion?.kind !== 'custom') {
    throw new Error(`no @ suggestion "${label}" for "${text}"`)
  }
  return applyAutocomplete(text, trigger, suggestion.insert)
}

function renderSent(text: string): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement('Text', null, botTeamMentionNodes(text, 'k', TARGETS)))
  })
  return renderer
}

describe('the phone @ menu, picked and then sent', () => {
  it('inserts a bot as @Name followed by exactly one space, where the caret waits', () => {
    expect(tapSuggestion('@Ir', 'Iris')).toEqual({ text: '@Iris ', cursor: 6 })
  })

  it('inserts a team the same way, keeping the text before the trigger', () => {
    expect(tapSuggestion('hola @War', 'Warehouse').text).toBe('hola @Warehouse ')
  })

  it('draws the sent mention as a chip labelled with the name alone', () => {
    const renderer = renderSent(`${tapSuggestion('@Ir', 'Iris').text}ya lo tiene`)
    const chips = renderer.root.findAll((node) => node.type === BotTeamMentionChip)

    expect(chips.map((chip) => chip.props.label)).toEqual(['Iris'])
  })

  it('lets one backspace remove a mention the phone inserted, as on the desktop', () => {
    const picked = tapSuggestion('@Ir', 'Iris').text

    expect(removeBotTeamMentionBeforeCaret(picked, picked.length, TARGETS)).toEqual({
      text: '',
      caret: 0
    })
  })
})
