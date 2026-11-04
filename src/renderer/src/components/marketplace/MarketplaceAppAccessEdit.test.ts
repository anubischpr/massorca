import { describe, expect, it } from 'vitest'
import { everyoneAccessPolicy } from '../../../../shared/marketplace-apps'
import {
  withAgentMode,
  withAgentPicked,
  withBotMode,
  withBotPicked,
  withTeamPicked
} from './MarketplaceAppAccessEdit'

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
})
