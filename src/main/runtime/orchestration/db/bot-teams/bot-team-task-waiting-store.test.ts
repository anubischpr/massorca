import { afterEach, describe, expect, it } from 'vitest'
import { BotTeamTaskSchema } from '../../../../../shared/rpc-contract/bot-team-room-params'
import { BOT_TEAM_TASK_LAST_STATUSES } from '../../../../../shared/bot-team-task-status'
import { OrchestrationDb } from '../orchestration-db'

describe('a task that waits for the person', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function startedTask(sessionId: string) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Review',
      prompt: 'Look at this',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, sessionId)
    return task
  }

  it('flags only the task that waits, on every read of it', () => {
    const task = startedTask('s1')
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()

    db!.markBotTeamTaskWaiting(task.id)

    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)
    expect(db!.listBotTeamTasks(task.teamId)[0].awaitingPerson).toBe(true)
    expect(db!.findBotTeamTaskBySession('s1')?.awaitingPerson).toBe(true)
  })

  it('does not show Done as a waiting state to a client from before it: the stored status stays terminal', () => {
    const task = startedTask('s1')
    db!.setBotTeamTaskLastStatus('s1', 'Done')
    db!.markBotTeamTaskWaiting(task.id)

    const sent = db!.listBotTeamTasks(task.teamId)[0]
    const olderClient = BotTeamTaskSchema.omit({ awaitingPerson: true })

    expect(BOT_TEAM_TASK_LAST_STATUSES).toContain(sent.lastStatus)
    expect(olderClient.parse(sent).lastStatus).toBe('Done')
  })

  it('clears the wait when the session works again, stops or gets stuck', () => {
    const task = startedTask('s1')
    db!.setBotTeamTaskLastStatus('s1', 'Done')
    db!.markBotTeamTaskWaiting(task.id)
    db!.setBotTeamTaskLastStatus('s1', 'Done')
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)

    db!.setBotTeamTaskLastStatus('s1', null)
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()

    db!.markBotTeamTaskWaiting(task.id)
    db!.setBotTeamTaskLastStatus('s1', 'Stuck')
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()
  })

  it('lists a team’s waiting tasks, the one that began waiting last first', () => {
    const first = startedTask('s1')
    const second = db!.createBotTeamTask({
      teamId: first.teamId,
      title: 'Other',
      prompt: 'Other',
      ownerBotId: first.ownerBotId
    })
    db!.setBotTeamTaskSession(second.id, 's2')
    db!.markBotTeamTaskWaiting(first.id, 100)
    db!.markBotTeamTaskWaiting(second.id, 200)

    expect(db!.listWaitingBotTeamTasks(first.teamId).map((entry) => entry.task.id)).toEqual([
      second.id,
      first.id
    ])

    db!.clearBotTeamTaskWaiting(second.id)
    expect(db!.listWaitingBotTeamTasks(first.teamId).map((entry) => entry.task.id)).toEqual([
      first.id
    ])
  })
})
