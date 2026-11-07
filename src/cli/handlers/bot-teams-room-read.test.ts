import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture } from '../test-fixtures'
import {
  BOT_REPLY,
  TEAM,
  assistantItem,
  roomWith,
  routeRpcFixtures
} from '../bot-teams-test-fixtures'

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

describe('orca bot-teams room read views', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists room messages with their authors and attached files', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.listRoom': okFixture('req_room', roomWith())
    })

    await main(['bot-teams', 'messages', '--team', 'team-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoom', { teamId: 'team-1' })
    expect(printed()).toBe(
      'msg-1  you  Please draft the notes  [files: brief.pdf]\nmsg-2  Estrellita  On it'
    )
  })

  it('prints messages as JSON, trimmed to the last --limit', async () => {
    routeRpcFixtures(callMock, { 'botTeams.listRoom': okFixture('req_room', roomWith()) })

    await main(['bot-teams', 'messages', '--team', 'team-1', '--limit', '1', '--json'], '/tmp/repo')

    expect(JSON.parse(printed()).result.messages).toEqual([BOT_REPLY])
  })

  it('lists tasks with their status and owner', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.listRoom': okFixture('req_room', roomWith())
    })

    await main(['bot-teams', 'tasks', '--team', 'team-1'], '/tmp/repo')

    expect(printed()).toBe(
      [
        'task-1  Not started  Estrellita  Fix flaky test',
        'task-2  Done  Pepe  Write release notes',
        'task-3  Waiting for you  Estrellita  Draft changelog'
      ].join('\n')
    )
  })

  it('shows one task with its owner, project and the final text of its session', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'agentSession.history': okFixture('req_history', {
        ok: true,
        page: { items: [assistantItem('Release notes drafted in notes.md')] }
      })
    })

    await main(['bot-teams', 'task', 'show', '--team', 'team-1', '--task', 'task-2'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith(
      'agentSession.history',
      expect.objectContaining({ sessionId: 'session-2', direction: 'tail' })
    )
    expect(printed()).toBe(
      [
        'Write release notes (task-2)',
        'Status: Done',
        'Owner: Pepe',
        'Project: Launch',
        'Result:',
        'Release notes drafted in notes.md'
      ].join('\n')
    )
  })

  it('says no result exists yet for a task that has not started', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.listRoom': okFixture('req_room', roomWith())
    })

    await main(['bot-teams', 'task', 'show', '--team', 'team-1', '--task', 'task-1'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalledWith('agentSession.history', expect.anything())
    expect(printed()).toContain('Result: none yet')
  })

  it('refuses task show for a task the team does not have', async () => {
    routeRpcFixtures(callMock, { 'botTeams.listRoom': okFixture('req_room', roomWith()) })

    await main(['bot-teams', 'task', 'show', '--team', 'team-1', '--task', 'task-9'], '/tmp/repo')

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('No task task-9 on this team.')
    expect(process.exitCode).toBe(1)
  })
})
