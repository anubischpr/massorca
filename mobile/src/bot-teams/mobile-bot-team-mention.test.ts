import { describe, expect, it } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { botTeamMentionTargets } from './mobile-bot-team-mention'

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
})
