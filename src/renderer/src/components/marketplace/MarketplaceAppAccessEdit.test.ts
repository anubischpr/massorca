import { describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  type MarketplaceBotAccess
} from '../../../../shared/marketplace-apps'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import {
  marketplaceTeamAllowed,
  withAgentMode,
  withAgentPicked,
  withBotMode,
  withBotPicked,
  withTeamAllowed,
  withTeamPicked
} from './MarketplaceAppAccessEdit'

function bot(id: string, agent: TuiAgent = 'claude'): BotTeamBot {
  return { id, name: id, job: '', agent, modelMode: 'auto', model: null, effort: null, skills: [] }
}

function team(bots: BotTeamBot[]): BotTeam {
  return {
    id: 'team-a',
    name: 'Alpha',
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots
  }
}

const alpha = team([bot('bot-1'), bot('bot-2')])

describe('access policy edits', () => {
  it('lists picked agents in catalog order, whatever order they were picked in', () => {
    const agents = everyoneAccessPolicy().agents
    const picked = withAgentPicked(withAgentPicked(agents, 'gentle-shell', true), 'claude', true)
    expect(picked.ids).toEqual(['claude', 'gentle-shell'])
  })

  it('unpicks one agent and keeps the others', () => {
    const agents = { mode: 'only' as const, ids: ['claude' as const, 'codex' as const] }
    expect(withAgentPicked(agents, 'claude', false).ids).toEqual(['codex'])
    expect(withAgentPicked(agents, 'codex', true).ids).toEqual(['claude', 'codex'])
  })

  it('keeps the picks when the mode changes, so switching back restores them', () => {
    const agents = { mode: 'only' as const, ids: ['codex' as const] }
    const everyone = withAgentMode(agents, 'everyone')
    expect(everyone).toEqual({ mode: 'everyone', ids: ['codex'] })
    expect(withAgentMode(everyone, 'only').ids).toEqual(['codex'])
  })

  it('toggles a bot without touching the teams, and never lists a bot twice', () => {
    const bots = everyoneAccessPolicy().bots
    const once = withBotPicked(bots, 'bot-1', true)
    const twice = withBotPicked(once, 'bot-1', true)
    expect(twice.botIds).toEqual(['bot-1'])
    expect(twice.teamIds).toEqual([])
    expect(withBotPicked(twice, 'bot-1', false).botIds).toEqual([])
  })

  it('toggles a whole team without touching the bots, and keeps the bot mode', () => {
    const bots = withBotMode({ ...everyoneAccessPolicy().bots, botIds: ['bot-1'] }, 'except')
    const picked = withTeamPicked(bots, 'team-a', true)
    expect(picked).toEqual({ mode: 'except', botIds: ['bot-1'], teamIds: ['team-a'] })
    expect(withTeamPicked(picked, 'team-a', false).teamIds).toEqual([])
  })

  it('turns a team off under Everyone by excepting only that team, dropping dormant picks', () => {
    const everyone: MarketplaceBotAccess = {
      mode: 'everyone',
      botIds: ['bot-9'],
      teamIds: ['team-b']
    }
    expect(withTeamAllowed(everyone, alpha, false)).toEqual({
      mode: 'except',
      botIds: [],
      teamIds: ['team-a']
    })
  })

  it('turns a team on under Everyone by changing nothing', () => {
    const everyone: MarketplaceBotAccess = { mode: 'everyone', botIds: [], teamIds: [] }
    expect(withTeamAllowed(everyone, alpha, true)).toEqual(everyone)
  })

  it('turns a team off under All except by adding it and keeps the other picks', () => {
    const bots: MarketplaceBotAccess = { mode: 'except', botIds: ['bot-9'], teamIds: ['team-b'] }
    expect(withTeamAllowed(bots, alpha, false)).toEqual({
      mode: 'except',
      botIds: ['bot-9'],
      teamIds: ['team-b', 'team-a']
    })
  })

  it('turns a team on under All except by removing it and its bots', () => {
    const bots: MarketplaceBotAccess = {
      mode: 'except',
      botIds: ['bot-1', 'bot-9'],
      teamIds: ['team-a', 'team-b']
    }
    expect(withTeamAllowed(bots, alpha, true)).toEqual({
      mode: 'except',
      botIds: ['bot-9'],
      teamIds: ['team-b']
    })
  })

  it('turns a team off under Only these by removing it and its bots, keeping other picks', () => {
    const bots: MarketplaceBotAccess = {
      mode: 'only',
      botIds: ['bot-1', 'bot-9'],
      teamIds: ['team-a', 'team-b']
    }
    expect(withTeamAllowed(bots, alpha, false)).toEqual({
      mode: 'only',
      botIds: ['bot-9'],
      teamIds: ['team-b']
    })
  })

  it('turns a team on under Only these by adding it', () => {
    const bots: MarketplaceBotAccess = { mode: 'only', botIds: [], teamIds: ['team-b'] }
    expect(withTeamAllowed(bots, alpha, true)).toEqual({
      mode: 'only',
      botIds: [],
      teamIds: ['team-b', 'team-a']
    })
  })

  it('uses the team pick alone for a team with no bots', () => {
    const empty = team([])
    const bots: MarketplaceBotAccess = { mode: 'only', botIds: [], teamIds: [] }
    expect(withTeamAllowed(bots, empty, true).teamIds).toEqual(['team-a'])
    expect(withTeamAllowed(bots, empty, false).teamIds).toEqual([])
  })

  it('reports a team allowed only when every bot in it is allowed, or its pick covers an empty team', () => {
    const only: MarketplaceBotAccess = { mode: 'only', botIds: ['bot-1'], teamIds: [] }
    const whole: MarketplaceBotAccess = { mode: 'only', botIds: [], teamIds: ['team-a'] }
    const except: MarketplaceBotAccess = { mode: 'except', botIds: [], teamIds: ['team-a'] }
    const policy = (bots: MarketplaceBotAccess) => ({ ...everyoneAccessPolicy(), bots })
    expect(marketplaceTeamAllowed(policy(only), alpha)).toBe(false)
    expect(marketplaceTeamAllowed(policy(whole), alpha)).toBe(true)
    expect(marketplaceTeamAllowed(policy(except), alpha)).toBe(false)
    expect(marketplaceTeamAllowed(policy(whole), team([]))).toBe(true)
    expect(marketplaceTeamAllowed(policy(except), team([]))).toBe(false)
  })
})
