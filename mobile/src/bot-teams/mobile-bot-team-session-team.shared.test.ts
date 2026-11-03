import { describe, expect, it, vi } from 'vitest'
import { loadSharedMobileBotTeamSessionTeams } from './mobile-bot-team-session-team'

describe('loadSharedMobileBotTeamSessionTeams', () => {
  it('shares one in-flight read per host client, so every row reads the same answer', async () => {
    const sendRequest = vi.fn(async () => ({
      ok: true,
      result: {
        sessionTeams: {
          claude_1: { teamId: 'team-a', teamName: 'Team A', character: 'square' }
        }
      }
    }))
    const client = { sendRequest }

    const [first, second] = await Promise.all([
      loadSharedMobileBotTeamSessionTeams(client as never),
      loadSharedMobileBotTeamSessionTeams(client as never)
    ])

    expect(sendRequest).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
    expect(first.claude_1?.teamName).toBe('Team A')
  })
})
