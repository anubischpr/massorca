import { describe, expect, it, vi } from 'vitest'
import {
  botTeamForPaneKey,
  listMobileBotTeamSessionTeams,
  sessionIdFromPaneKey
} from './mobile-bot-team-session-team'

type HostClient = Parameters<typeof listMobileBotTeamSessionTeams>[0]

const TEAM = { teamId: 'team_1', teamName: 'Marketing', character: 'circle' as const }

describe('sessionIdFromPaneKey', () => {
  it('reads the session id from a structured session pane key', () => {
    expect(sessionIdFromPaneKey('structured-agent-session-abc:leaf-1')).toBe('abc')
  })

  it('returns null for a terminal pane key', () => {
    expect(sessionIdFromPaneKey('tab-terminal-1:leaf-1')).toBeNull()
  })
})

describe('botTeamForPaneKey', () => {
  it('finds the team of a bot-team session and nothing for other sessions', () => {
    const sessionTeams = { abc: TEAM }

    expect(botTeamForPaneKey(sessionTeams, 'structured-agent-session-abc:leaf-1')).toEqual(TEAM)
    expect(botTeamForPaneKey(sessionTeams, 'structured-agent-session-xyz:leaf-1')).toBeUndefined()
  })
})

describe('listMobileBotTeamSessionTeams', () => {
  it('reads the host map of bot-team sessions', async () => {
    const sendRequest = vi.fn(async () => ({
      id: '1',
      _meta: { runtimeId: 'r' },
      ok: true,
      result: { sessionTeams: { abc: TEAM } }
    }))
    const client = { sendRequest } as unknown as HostClient

    expect(await listMobileBotTeamSessionTeams(client)).toEqual({ abc: TEAM })
    expect(sendRequest).toHaveBeenCalledWith('botTeams.sessionTeams', null, expect.any(Object))
  })

  it('treats a host that has no such method as having no bot-team sessions', async () => {
    const sendRequest = vi.fn(async () => {
      throw new Error('method not found')
    })
    const client = { sendRequest } as unknown as HostClient

    expect(await listMobileBotTeamSessionTeams(client)).toEqual({})
  })
})
