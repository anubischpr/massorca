import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote: boolean
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()

    constructor(
      _userDataPath?: string,
      _requestTimeoutMs?: number,
      remotePairingCode = process.env.ORCA_PAIRING_CODE ?? null,
      environmentSelector = process.env.ORCA_ENVIRONMENT ?? null
    ) {
      this.isRemote = Boolean(remotePairingCode || environmentSelector)
    }
  }

  // Why: re-export the REAL error classes; format.ts narrows with `instanceof`
  // against ./runtime/types, so a look-alike would collapse every CLI error
  // code into the generic `runtime_error` shape.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')

  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError
  }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'

function team(id: string, name: string, botCount: number) {
  return {
    id,
    name,
    purpose: '',
    character: 'focused',
    workspacesEnabled: false,
    accessMode: 'read-only',
    bots: Array.from({ length: botCount }, (_, index) => ({
      id: `${id}-bot-${index}`,
      name: `Bot ${index}`
    }))
  }
}

function room() {
  return {
    tasks: [
      { id: 'task-1', title: 'Fix flaky test', sessionId: null, createdAt: 100 },
      {
        id: 'task-2',
        title: 'Write release notes',
        sessionId: 'session-1',
        lastStatus: 'Done',
        createdAt: 200
      },
      {
        id: 'task-3',
        title: 'Draft changelog',
        sessionId: 'session-2',
        awaitingPerson: true,
        createdAt: 300
      }
    ],
    messages: [{ id: 'message-1' }, { id: 'message-2' }, { id: 'message-3' }],
    sentRequests: []
  }
}

const routines = [
  {
    id: 'routine-1',
    name: 'Morning digest',
    schedule: {
      frequency: 'daily',
      time: '09:00',
      weekday: null,
      monthDay: null,
      date: null,
      timeZone: 'Europe/Madrid'
    },
    paused: false
  },
  {
    id: 'routine-2',
    name: 'Weekly review',
    schedule: {
      frequency: 'weekly',
      time: '17:30',
      weekday: 1,
      monthDay: null,
      date: null,
      timeZone: null
    },
    paused: true
  },
  {
    id: 'routine-3',
    name: 'Launch check',
    schedule: {
      frequency: 'once',
      time: '08:00',
      weekday: null,
      monthDay: null,
      date: '2026-11-04',
      timeZone: null
    },
    paused: false
  }
]

describe('orca bot-teams CLI handlers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    // Why: these tests can run inside an Orca-managed terminal, which exports
    // real worktree/terminal/pairing env hints; clear them so handler context
    // assertions stay deterministic.
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists each team with its id, name, and bot count', async () => {
    queueFixtures(
      callMock,
      okFixture('req_teams', { teams: [team('team-1', 'Support', 2), team('team-2', 'Ops', 1)] })
    )

    await main(['bot-teams', 'list'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.list')
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      'team-1  Support  2 bots\nteam-2  Ops  1 bot'
    )
  })

  it('prints the team list as the full JSON response', async () => {
    const response = okFixture('req_teams', { teams: [team('team-1', 'Support', 2)] })
    queueFixtures(callMock, response)

    await main(['bot-teams', 'list', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.list')
    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
  })

  it('shows room counts and the latest tasks with their status', async () => {
    queueFixtures(callMock, okFixture('req_room', room()))

    await main(['bot-teams', 'room', '--team', 'team-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoom', { teamId: 'team-1' })
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      [
        'Tasks: 3',
        'Messages: 3',
        'Latest tasks:',
        '  - Draft changelog (Waiting for you)',
        '  - Write release notes (Done)',
        '  - Fix flaky test (Not started)'
      ].join('\n')
    )
  })

  it('prints the full room data as JSON', async () => {
    const response = okFixture('req_room', room())
    queueFixtures(callMock, response)

    await main(['bot-teams', 'room', '--team', 'team-1', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoom', { teamId: 'team-1' })
    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
  })

  it('refuses room without --team before calling the host', async () => {
    await main(['bot-teams', 'room'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('Missing required --team')
    expect(process.exitCode).toBe(1)
  })

  it('lists routines with their schedule and paused state', async () => {
    queueFixtures(callMock, okFixture('req_routines', { routines }))

    await main(['bot-teams', 'routines', '--team', 'team-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoutines', { teamId: 'team-1' })
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      [
        'Morning digest  daily at 09:00 Europe/Madrid  active',
        'Weekly review  weekly on Monday at 17:30  paused',
        'Launch check  once on 2026-11-04 at 08:00  active'
      ].join('\n')
    )
  })

  it('prints the routine list as the full JSON response', async () => {
    const response = okFixture('req_routines', { routines })
    queueFixtures(callMock, response)

    await main(['bot-teams', 'routines', '--team', 'team-1', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoutines', { teamId: 'team-1' })
    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
  })
})
