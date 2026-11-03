import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { useMobileBotTeamStatus } from './use-mobile-bot-team-status'

const session = vi.hoisted(() => ({ statuses: new Map<string, unknown>() }))

vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => session.statuses
  })
}))
vi.mock('../../../src/shared/bot-team-task-status', () => ({
  botTeamTaskStatus: (sessionId: string | null, summary: unknown) =>
    sessionId === null ? 'Not started' : summary
}))
vi.mock('./mobile-bot-team-room-rpc', () => ({
  listMobileBotTeamRoom: async (_client: unknown, teamId: string) => {
    if (teamId === 'gone') {
      return null
    }
    return {
      tasks:
        teamId === 'busy'
          ? [
              { id: 't1', sessionId: 's1' },
              { id: 't2', sessionId: null }
            ]
          : [{ id: 't3', sessionId: null }]
    }
  }
}))

const TEAMS = [{ id: 'busy' }, { id: 'idle' }, { id: 'gone' }] as unknown as BotTeam[]
const client = {} as RpcClient

describe('useMobileBotTeamStatus', () => {
  it('reads each team from its tasks and the live session status', async () => {
    session.statuses = new Map([['s1', 'Working']])
    let statusOf!: (teamId: string) => string
    const Probe = () => {
      statusOf = useMobileBotTeamStatus(client, TEAMS)
      return null
    }
    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(createElement(Probe))
    })
    expect(statusOf('busy')).toBe('Working')
    expect(statusOf('idle')).toBe('Nothing running')
    expect(statusOf('gone')).toBe('Nothing running')
    act(() => renderer.unmount())
  })
})
