import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { answerWaitingBotTeamTask } from './bot-team-task-answer'
import { postBotTeamTaskQuestion } from './bot-team-task-question'

describe('the room hears the bot’s answer to a follow-up turn', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    vi.useRealTimers()
  })

  function waitingTask() {
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Catalina', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Review',
      prompt: 'Look at this',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    db.setBotTeamTaskLastStatus('session-1', 'Done')
    db.postBotTeamMessage({ teamId: team.id, authorBotId: task.ownerBotId, text: 'On it' })
    db.markBotTeamTaskWaiting(task.id)
    return { team, task }
  }

  const answer = (teamId: string) => {
    // Why: the room orders by clock, so the person's line must land after the bot's "On it".
    vi.setSystemTime(Date.now() + 1000)
    db!.postBotTeamMessage({ teamId, authorBotId: null, text: 'El resumen, por favor' })
    vi.setSystemTime(Date.now() + 1000)
    return answerWaitingBotTeamTask(
      db!,
      { sendToSession: async () => true },
      { teamId, text: 'El resumen, por favor', attachments: [] }
    )
  }
  const finish = (reply: string) => ({ settleMs: 0, lastReplyOf: async () => reply })
  const roomLines = (teamId: string) => db!.listBotTeamMessages(teamId).map((m) => m.text)

  it('posts the bot’s reply as its line when the bot posted nothing after the answer', async () => {
    const { team, task } = waitingTask()
    await answer(team.id)

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))

    const posted = db!.listBotTeamMessages(team.id).at(-1)
    expect(posted).toMatchObject({
      authorBotId: task.ownerBotId,
      text: 'Listo, aqui esta el resumen.'
    })
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()
  })

  it('posts it once even when the finish is reported twice', async () => {
    const { team } = waitingTask()
    await answer(team.id)

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))
    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))

    expect(roomLines(team.id).filter((text) => text.includes('resumen.'))).toHaveLength(1)
  })

  it('adds nothing when the bot already posted its own line after the answer', async () => {
    const { team, task } = waitingTask()
    await answer(team.id)
    vi.setSystemTime(Date.now() + 1000)
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: task.ownerBotId, text: 'Ya lo tengo.' })
    const before = roomLines(team.id).length

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))

    expect(roomLines(team.id)).toHaveLength(before)
  })

  it('posts the reply of a normal task whose bot only said its start acknowledgement', async () => {
    const { team, task } = waitingTask()
    db!.clearBotTeamTaskWaiting(task.id)
    vi.setSystemTime(Date.now() + 1000)

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))
    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))

    expect(roomLines(team.id)).toEqual(['On it', 'Listo, aqui esta el resumen.'])
  })

  it('adds nothing to a normal task whose bot already posted its own line', async () => {
    const { team, task } = waitingTask()
    db!.clearBotTeamTaskWaiting(task.id)
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: task.ownerBotId, text: 'Termin.' })

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo, aqui esta el resumen.'))

    expect(roomLines(team.id)).toEqual(['On it', 'Termin.'])
  })
})
