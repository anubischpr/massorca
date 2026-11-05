import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { answerWaitingBotTeamTask, BOT_TEAM_QUESTION_WAIT_MS } from './bot-team-task-answer'

describe('the person’s reply to a bot that asked in the room', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function waitingTask(since = Date.now()) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Catalina', job: '', agent: 'claude' },
        { name: 'Max', job: '', agent: 'claude' }
      ]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Revisión de captura',
      prompt: 'Mira esta imagen',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    db.setBotTeamTaskLastStatus('session-1', 'Done')
    db.markBotTeamTaskWaiting(task.id, since)
    return { team, task }
  }

  function sender(delivered = true) {
    const sent: { sessionId: string; text: string }[] = []
    return {
      sent,
      sendToSession: async (sessionId: string, text: string) => {
        sent.push({ sessionId, text })
        return delivered
      }
    }
  }

  it('reaches the bot’s own session as a follow-up and ends the wait', async () => {
    const { team, task } = waitingTask()
    const deps = sender()

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: 'Quiero un resumen de los campos visibles',
      attachments: []
    })

    expect(answered?.id).toBe(task.id)
    expect(deps.sent).toHaveLength(1)
    expect(deps.sent[0].sessionId).toBe('session-1')
    expect(deps.sent[0].text).toContain('Quiero un resumen de los campos visibles')
    expect(deps.sent[0].text).toContain('team-post')
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()
  })

  it('files nothing when no task waits for the person', async () => {
    const { team, task } = waitingTask()
    db!.clearBotTeamTaskWaiting(task.id)
    const deps = sender()

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: 'Hazme un flyer',
      attachments: []
    })

    expect(answered).toBeNull()
    expect(deps.sent).toEqual([])
  })

  it('leaves a line that names another bot to that bot’s own new task', async () => {
    const { team, task } = waitingTask()
    const deps = sender()

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: '@Max haz un flyer',
      attachments: []
    })

    expect(answered).toBeNull()
    expect(deps.sent).toEqual([])
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)
  })

  it('answers the bot a line names when that bot waits', async () => {
    const { team, task } = waitingTask()
    const deps = sender()

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: '@Catalina el resumen, por favor',
      attachments: []
    })

    expect(answered?.id).toBe(task.id)
  })

  it('keeps the wait when the session did not take the reply', async () => {
    const { team, task } = waitingTask()
    const deps = sender(false)

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: 'El resumen',
      attachments: []
    })

    expect(answered).toBeNull()
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)
  })

  it('does not take a reply to a question that went unanswered for a day', async () => {
    const { team } = waitingTask(Date.now() - BOT_TEAM_QUESTION_WAIT_MS - 1000)
    const deps = sender()

    const answered = await answerWaitingBotTeamTask(db!, deps, {
      teamId: team.id,
      text: 'El resumen',
      attachments: []
    })

    expect(answered).toBeNull()
    expect(deps.sent).toEqual([])
  })
})
