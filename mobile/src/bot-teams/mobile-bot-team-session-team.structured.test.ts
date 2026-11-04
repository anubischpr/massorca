import { describe, expect, it } from 'vitest'
import { botTeamForStructuredSession } from './mobile-bot-team-session-team'

const team = { teamId: 'team-a', teamName: 'Team A', character: 'square' as const }

describe('botTeamForStructuredSession', () => {
  it('finds a history row’s team through its structured owner session id', () => {
    expect(
      botTeamForStructuredSession(
        { claude_1: team },
        { sessionId: 'claude_1', workspaceId: 'wt-1' }
      )
    ).toEqual(team)
  })

  it('finds no team for a row without a structured owner, or whose owner no team started', () => {
    expect(botTeamForStructuredSession({ claude_1: team }, undefined)).toBeUndefined()
    expect(
      botTeamForStructuredSession(
        { claude_1: team },
        { sessionId: 'claude_2', workspaceId: 'wt-1' }
      )
    ).toBeUndefined()
  })
})
