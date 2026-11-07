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
  TASK_1,
  TEAM,
  TWIN_NAME_TEAM,
  assistantItem,
  roomWith,
  routeRpcFixtures
} from '../bot-teams-test-fixtures'

const TASK_7 = { ...TASK_1, id: 'task-7', title: 'Draft the notes', ownerBotId: 'bot-1' }
const RUNNING = { ...TASK_7, sessionId: 'session-7', lastStatus: null }
const FINISHED = { ...RUNNING, lastStatus: 'Done' }
const ASSIGNED = okFixture('req_assign', { task: TASK_7, startError: null })

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

describe('orca bot-teams delegate', () => {
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

  it('hands work to a bot by name and returns without waiting', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': ASSIGNED
    })

    await main(
      [
        'bot-teams',
        'delegate',
        '--team',
        'team-1',
        '--bot',
        'estrellita',
        '--text',
        'Draft the notes'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      expect.objectContaining({
        teamId: 'team-1',
        text: 'Draft the notes',
        botId: 'bot-1',
        start: true
      })
    )
    expect(callMock).not.toHaveBeenCalledWith('botTeams.listRoom', expect.anything())
    expect(printed()).toBe(
      'Handed task task-7 (Draft the notes) to Estrellita.\nRead its result later: orca bot-teams task show --team team-1 --task task-7'
    )
  })

  it('waits until the bot finishes and prints its final text', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': ASSIGNED,
      'botTeams.listRoom': [
        okFixture('req_room', roomWith({ tasks: [RUNNING] })),
        okFixture('req_room', roomWith({ tasks: [FINISHED] }))
      ],
      'agentSession.history': okFixture('req_history', {
        ok: true,
        page: { items: [assistantItem('Notes drafted in notes.md')] }
      })
    })

    await main(
      [
        'bot-teams',
        'delegate',
        '--team',
        'team-1',
        '--bot',
        'Estrellita',
        '--text',
        'Draft the notes',
        '--wait',
        '--timeout',
        '2'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'agentSession.history',
      expect.objectContaining({ sessionId: 'session-7' })
    )
    expect(printed()).toBe(
      'Estrellita finished "Draft the notes" (Done).\nNotes drafted in notes.md'
    )
    expect(process.exitCode).toBeUndefined()
  })

  it('exits 1 when the task is still running at the --timeout', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': ASSIGNED,
      'botTeams.listRoom': okFixture('req_room', roomWith({ tasks: [TASK_7] }))
    })

    await main(
      [
        'bot-teams',
        'delegate',
        '--team',
        'team-1',
        '--bot',
        'Estrellita',
        '--text',
        'x',
        '--wait',
        '--timeout',
        '1'
      ],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('still running')
    expect(process.exitCode).toBe(1)
  })

  it('exits 1 and reports the status when the task ends stuck', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': ASSIGNED,
      'botTeams.listRoom': okFixture(
        'req_room',
        roomWith({ tasks: [{ ...FINISHED, lastStatus: 'Stuck' }] })
      ),
      'agentSession.history': okFixture('req_history', { ok: true, page: { items: [] } })
    })

    await main(
      [
        'bot-teams',
        'delegate',
        '--team',
        'team-1',
        '--bot',
        'Estrellita',
        '--text',
        'x',
        '--wait',
        '--timeout',
        '2'
      ],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('Stuck')
    expect(process.exitCode).toBe(1)
  })

  it('refuses an ambiguous bot name before filing anything', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TWIN_NAME_TEAM] }),
      'botTeams.assignRequest': ASSIGNED
    })

    await main(
      ['bot-teams', 'delegate', '--team', 'team-1', '--bot', 'ana', '--text', 'x'],
      '/tmp/repo'
    )

    expect(callMock).not.toHaveBeenCalledWith('botTeams.assignRequest', expect.anything())
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('matches 2 bots')
    expect(process.exitCode).toBe(1)
  })

  it('exits 1 when the task did not start, and says it stays in Todo', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': okFixture('req_assign', {
        task: TASK_7,
        startError: 'The agent is not installed.'
      })
    })

    await main(
      ['bot-teams', 'delegate', '--team', 'team-1', '--bot', 'Estrellita', '--text', 'x'],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('did not start')
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('stays in Todo')
    expect(process.exitCode).toBe(1)
  })
})
