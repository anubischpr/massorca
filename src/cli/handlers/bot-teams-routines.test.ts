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
import { TEAM, routeRpcFixtures } from '../bot-teams-test-fixtures'

const ROUTINE = {
  id: 'routine-1',
  teamId: 'team-1',
  botId: 'bot-1',
  name: 'Morning digest',
  prompt: 'Summarize the room',
  schedule: {
    frequency: 'daily',
    time: '09:00',
    weekday: null,
    monthDay: null,
    date: null,
    timeZone: 'Europe/Madrid'
  },
  paused: false,
  nextRun: null,
  lastRun: null
}
const ROUTINES = okFixture('req_routines', { routines: [ROUTINE] })

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

describe('orca bot-teams routine writes', () => {
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

  it('creates a daily routine for a bot by name in the given zone', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.createRoutine': okFixture('req_create', { routine: ROUTINE })
    })

    await main(
      [
        'bot-teams',
        'routine',
        'create',
        '--team',
        'team-1',
        '--bot',
        'Estrellita',
        '--name',
        'Morning digest',
        '--prompt',
        'Summarize the room',
        '--time',
        '09:00',
        '--frequency',
        'daily',
        '--zone',
        'Europe/Madrid'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.createRoutine',
      expect.objectContaining({
        teamId: 'team-1',
        botId: 'bot-1',
        name: 'Morning digest',
        prompt: 'Summarize the room',
        schedule: expect.objectContaining({
          frequency: 'daily',
          time: '09:00',
          timeZone: 'Europe/Madrid'
        })
      })
    )
    expect(printed()).toBe('Created routine Morning digest (routine-1).')
  })

  it('changes only the fields given and keeps the rest of the routine', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoutines': ROUTINES,
      'botTeams.updateRoutine': okFixture('req_update', { routine: ROUTINE })
    })

    await main(
      [
        'bot-teams',
        'routine',
        'update',
        '--team',
        'team-1',
        '--routine',
        'Morning digest',
        '--time',
        '08:30'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.updateRoutine',
      expect.objectContaining({
        routineId: 'routine-1',
        botId: 'bot-1',
        name: 'Morning digest',
        prompt: 'Summarize the room',
        schedule: expect.objectContaining({
          frequency: 'daily',
          time: '08:30',
          timeZone: 'Europe/Madrid'
        })
      })
    )
    expect(printed()).toBe('Updated routine Morning digest (routine-1).')
  })

  it('deletes a routine found by id', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoutines': ROUTINES,
      'botTeams.deleteRoutine': okFixture('req_delete', { deleted: true })
    })

    await main(
      ['bot-teams', 'routine', 'rm', '--team', 'team-1', '--routine', 'routine-1'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.deleteRoutine', { routineId: 'routine-1' })
    expect(printed()).toBe('Deleted routine Morning digest (routine-1).')
  })

  it('pauses a routine', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoutines': ROUTINES,
      'botTeams.setRoutinePaused': okFixture('req_pause', { routine: { ...ROUTINE, paused: true } })
    })

    await main(
      ['bot-teams', 'routine', 'pause', '--team', 'team-1', '--routine', 'Morning digest'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.setRoutinePaused', {
      routineId: 'routine-1',
      paused: true
    })
    expect(printed()).toBe('Paused routine Morning digest (routine-1).')
  })

  it('resumes a routine', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoutines': ROUTINES,
      'botTeams.setRoutinePaused': okFixture('req_resume', { routine: ROUTINE })
    })

    await main(
      ['bot-teams', 'routine', 'resume', '--team', 'team-1', '--routine', 'Morning digest'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.setRoutinePaused', {
      routineId: 'routine-1',
      paused: false
    })
    expect(printed()).toBe('Resumed routine Morning digest (routine-1).')
  })

  it('lists the runs of a routine, with the failed ones explained', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoutines': ROUTINES,
      'botTeams.listRoutineRuns': okFixture('req_runs', {
        runs: [
          {
            id: 'run-1',
            routineId: 'routine-1',
            scheduledFor: { date: '2026-11-07', time: '09:00' },
            taskId: 'task-3',
            error: null
          },
          {
            id: 'run-2',
            routineId: 'routine-1',
            scheduledFor: { date: '2026-11-06', time: '09:00' },
            taskId: null,
            error: 'The bot is gone.'
          }
        ]
      })
    })

    await main(
      ['bot-teams', 'routine', 'runs', '--team', 'team-1', '--routine', 'Morning digest'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.listRoutineRuns', { routineId: 'routine-1' })
    expect(printed()).toBe(
      '2026-11-07 09:00  task-3\n2026-11-06 09:00  no task  failed: The bot is gone.'
    )
  })
})
