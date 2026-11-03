import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team task last status', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A task whose session has started, as the room sees it. */
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
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, sessionId)
    return task
  }

  it('keeps no status for a task until its session reaches one', () => {
    const task = startedTask('session-1')

    expect(db!.getBotTeamTask(task.id).lastStatus ?? null).toBeNull()
  })

  it('keeps the status of the task whose session it is, and clears it when the session works again', () => {
    const task = startedTask('session-1')

    db!.setBotTeamTaskLastStatus('session-1', 'Done')
    expect(db!.getBotTeamTask(task.id).lastStatus).toBe('Done')
    expect(db!.listBotTeamTasks(task.teamId)[0].lastStatus).toBe('Done')

    db!.setBotTeamTaskLastStatus('session-1', null)
    expect(db!.getBotTeamTask(task.id).lastStatus ?? null).toBeNull()
  })

  it('ignores a session that no task runs', () => {
    startedTask('session-1')

    expect(() => db!.setBotTeamTaskLastStatus('other-session', 'Stuck')).not.toThrow()
  })
})
