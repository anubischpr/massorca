import { describe, expect, it } from 'vitest'
import { botTeamForAiVaultSession } from './ai-vault-bot-team-sessions'

const team = { teamId: 'team-a', teamName: 'Team A', character: 'square' as const }

describe('botTeamForAiVaultSession', () => {
  it('finds the team behind a history row through its Orca structured session id', () => {
    expect(
      botTeamForAiVaultSession(
        { structuredSession: { sessionId: 'claude_1', workspaceId: 'wt-1' } },
        { claude_1: team }
      )
    ).toEqual(team)
  })

  it('shows no team for a row without a structured owner or whose owner no team started', () => {
    expect(botTeamForAiVaultSession({}, { claude_1: team })).toBeUndefined()
    expect(
      botTeamForAiVaultSession(
        { structuredSession: { sessionId: 'claude_2', workspaceId: 'wt-1' } },
        { claude_1: team }
      )
    ).toBeUndefined()
  })
})
