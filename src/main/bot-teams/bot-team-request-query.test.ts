import { describe, expect, it } from 'vitest'
import { botTeamQueryAgent } from './bot-team-request-query'

const SETTINGS = { defaultTuiAgent: 'claude' as const, disabledTuiAgents: [] }

describe('botTeamQueryAgent', () => {
  it('runs a Gentle Shell bot through the Gentle Shell command, never the default agent', () => {
    const chosen = botTeamQueryAgent(
      { id: 'pi', model: null, effort: null, piRuntime: 'gentle-shell' },
      SETTINGS
    )
    expect(chosen).toEqual({ agentId: 'pi', override: 'gentle-shell --' })
  })

  it('keeps a configured Gentle Shell command and never takes a stock Pi one', () => {
    const bot = { id: 'pi', model: null, effort: null, piRuntime: 'gentle-shell' as const }
    expect(
      botTeamQueryAgent(bot, { ...SETTINGS, agentCmdOverrides: { pi: 'gentle-shell --debug' } })
    ).toEqual({ agentId: 'pi', override: 'gentle-shell --debug --' })
    expect(botTeamQueryAgent(bot, { ...SETTINGS, agentCmdOverrides: { pi: 'pi' } })).toEqual({
      agentId: 'pi',
      override: 'gentle-shell --'
    })
  })

  it('uses a bot’s own agent, and the Settings default only when the bot has none', () => {
    expect(botTeamQueryAgent({ id: 'codex', model: null, effort: null }, SETTINGS)).toEqual({
      agentId: 'codex',
      override: undefined
    })
    expect(botTeamQueryAgent(null, SETTINGS)).toEqual({ agentId: 'claude', override: undefined })
  })
})
