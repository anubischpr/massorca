import { afterEach, describe, expect, it, vi } from 'vitest'
import { botTeamClockNote } from '../../shared/bot-team-person-clock'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import { createBotTeamRoutine } from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest } from './bot-team-assign-request'
import { delegateToBotTeammate, type BotTeamDelegateDeps } from './bot-team-delegate'
import { createBotTeamRoutineScheduler } from './bot-team-routine-scheduler'
import { botTeamTaskPrompt } from './bot-team-task-start'

// 04:38 UTC on Wednesday 4 Nov is 23:38 on Tuesday 3 Nov in Lima: "mañana" is the 4th there.
const LIMA_NIGHT = Date.UTC(2026, 10, 4, 4, 38)
const LIMA_CLOCK = 'Tuesday 2026-11-03 23:38 America/Lima'
const NOT_STARTED = async (taskId: string): Promise<never> => {
  throw new Error(`Task ${taskId} should not start here.`)
}

const DELEGATE_TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    {
      id: 'max',
      name: 'Max',
      job: 'Writes files',
      agent: 'codex',
      modelMode: 'manual',
      model: 'gpt-6-astra',
      effort: 'high',
      skills: []
    }
  ]
}

describe("a task's clock is the sender's, from the moment they asked", () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    vi.useRealTimers()
  })

  it('keeps the clock the request was asked on, so a task started a day later still reads "mañana" on it', async () => {
    vi.useFakeTimers({ now: LIMA_NIGHT, toFake: ['Date'] })
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    const filed = await fileBotTeamRequest(
      db,
      {
        teamId: team.id,
        text: 'Escribe el informe para mañana',
        start: false,
        later: true,
        askProject: false,
        timeZone: 'America/Lima'
      },
      NOT_STARTED
    )
    const task = filed.task
    if (task === null) {
      throw new Error('The request was not filed.')
    }
    // The person starts it from Todo on Thursday, after the day they meant has passed.
    vi.setSystemTime(Date.UTC(2026, 10, 5, 15, 0))
    const prompt = botTeamTaskPrompt(team, team.bots[0], task, {
      notes: db.getBotTeamTaskStartNotes(task.id)
    })
    expect(prompt).toContain(LIMA_CLOCK)
    expect(prompt).not.toContain('2026-11-05')
  })

  it("starts a routine's task with the clock of its run, read on the routine's zone", async () => {
    db = new OrchestrationDb(':memory:')
    const database = db
    const team = database.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    let clock = Date.UTC(2026, 10, 3, 23, 0)
    const startTask = vi.fn(async () => undefined)
    const scheduler = createBotTeamRoutineScheduler({
      getDb: () => database,
      startTask,
      now: () => clock
    })
    createBotTeamRoutine(
      database,
      {
        teamId: team.id,
        botId: team.bots[0].id,
        name: 'Cierre del día',
        prompt: 'Resume lo de hoy.',
        schedule: {
          frequency: 'once',
          time: '23:30',
          weekday: null,
          monthDay: null,
          date: '2026-11-03',
          timeZone: 'America/Lima'
        }
      },
      clock
    )
    // 23:30 on Tuesday 3 Nov in Lima.
    clock = Date.UTC(2026, 10, 4, 4, 30)
    await scheduler.tick()
    const taskId = database.listBotTeamTasks(team.id)[0]?.id ?? ''
    expect(startTask).toHaveBeenCalledWith(taskId)
    expect(database.getBotTeamTaskStartNotes(taskId)).toContain(
      'Tuesday 2026-11-03 23:30 America/Lima'
    )
  })

  it("hands a teammate the clock the caller's request was asked on", async () => {
    const fileRequest = vi.fn(async (_request: { prompt: string }) => 'request-1')
    const deps: BotTeamDelegateDeps = {
      fileRequest,
      createTask: vi.fn((args) => ({ id: 'task', teamId: 'team', sessionId: null, ...args })),
      linkTask: vi.fn(),
      startRequest: vi.fn()
    }
    await delegateToBotTeammate(deps, {
      team: DELEGATE_TEAM,
      botName: 'Max',
      text: 'Escribe el informe para mañana',
      clock: botTeamClockNote(LIMA_NIGHT, 'America/Lima')
    })
    expect(fileRequest.mock.calls[0]?.[0].prompt).toContain(LIMA_CLOCK)
  })
})
