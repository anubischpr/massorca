import { describe, expect, it } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import {
  botTeamDraftMentions,
  botTeamMentionTargets,
  removeBotTeamDraftMention,
  type MobileBotTeamMentionTarget
} from './mobile-bot-team-mention'

const BOT = {
  id: 'bot',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}

function team(id: string, name: string, character: BotTeam['character'], bots = [BOT]): BotTeam {
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

describe('botTeamMentionTargets', () => {
  it('lists the room team bots and the other teams, not the room team itself', () => {
    const room = team('team', 'Marketing', 'circle')
    const other = team('team_2', 'Warehouse', 'square', [{ ...BOT, id: 'max', name: 'Max' }])

    expect(botTeamMentionTargets(room, [room, other])).toEqual([
      { name: 'Iris', kind: 'bot', agent: 'claude', character: null },
      { name: 'Warehouse', kind: 'team', agent: null, character: 'square' }
    ])
  })

  it('lists the connected apps last, as apps', () => {
    const room = team('team', 'Marketing', 'circle')

    expect(botTeamMentionTargets(room, [room], [], [{ id: 'engram', name: 'Engram' }])).toEqual([
      { name: 'Iris', kind: 'bot', agent: 'claude', character: null },
      { name: 'Engram', kind: 'app', agent: null, character: null }
    ])
  })
})

const IRIS: MobileBotTeamMentionTarget = {
  name: 'Iris',
  kind: 'bot',
  agent: 'claude',
  character: null
}
const WAREHOUSE: MobileBotTeamMentionTarget = {
  name: 'Warehouse',
  kind: 'team',
  agent: null,
  character: 'square'
}

describe('botTeamDraftMentions', () => {
  it('finds a known mention in the draft with the span it covers', () => {
    expect(botTeamDraftMentions('hola @Iris mira', [IRIS])).toEqual([
      { kind: 'mention', target: IRIS, start: 5, end: 10 }
    ])
  })

  it('finds a file path the draft names, with the span it covers', () => {
    expect(botTeamDraftMentions('ve @site/flyer.html ya', [])).toEqual([
      { kind: 'file', path: 'site/flyer.html', start: 3, end: 19 }
    ])
  })

  it('draws no pill for a mention still at the end of the draft, or for an unknown name', () => {
    expect(botTeamDraftMentions('hola @Iris', [IRIS])).toEqual([])
    expect(botTeamDraftMentions('hola @Nadie ya', [IRIS])).toEqual([])
  })
})

describe('removeBotTeamDraftMention', () => {
  it('takes the mention and the space after it out of the draft', () => {
    const text = 'hola @Iris mira'
    const [mention] = botTeamDraftMentions(text, [IRIS])

    expect(removeBotTeamDraftMention(text, mention)).toBe('hola mira')
  })

  it('takes the space before it out when a punctuation mark follows', () => {
    const text = 'pásalo a @Warehouse.'
    const [mention] = botTeamDraftMentions(text, [WAREHOUSE])

    expect(removeBotTeamDraftMention(text, mention)).toBe('pásalo a.')
  })

  it('takes a file pill out with its path, and leaves the other mentions in place', () => {
    const file = 've @site/flyer.html ya'
    const [fileMention] = botTeamDraftMentions(file, [])
    expect(removeBotTeamDraftMention(file, fileMention)).toBe('ve ya')

    const text = '@Iris y @Warehouse ya'
    const [iris] = botTeamDraftMentions(text, [IRIS, WAREHOUSE])
    expect(removeBotTeamDraftMention(text, iris)).toBe('y @Warehouse ya')
  })
})
