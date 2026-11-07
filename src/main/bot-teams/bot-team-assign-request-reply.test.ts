import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest, type BotTeamRequestFiling } from './bot-team-assign-request'

const NOT_STARTED = async (taskId: string): Promise<never> => {
  throw new Error(`Task ${taskId} should not start here.`)
}

describe('a reply filed as a task', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    const alpha = db.createBotTeamProject({
      teamId: team.id,
      name: 'Alpha',
      goal: '',
      codeSource: null
    })
    const beta = db.createBotTeamProject({
      teamId: team.id,
      name: 'Beta',
      goal: '',
      codeSource: null
    })
    const line = db.postBotTeamMessage({
      teamId: team.id,
      authorBotId: team.bots[0].id,
      text: 'Listo, el flyer está listo.'
    })
    return { database: db, team, alpha, beta, line }
  }

  /** A reply filed the way the room files one: the question is asked only when a reply allows it. */
  function replyTo(
    database: OrchestrationDb,
    teamId: string,
    quote: BotTeamRequestFiling['quote'],
    text: string
  ) {
    return fileBotTeamRequest(
      database,
      { teamId, text, start: false, later: false, askProject: true, quote },
      NOT_STARTED
    )
  }

  it('files a reply without the project question when the quoted line came from no task', async () => {
    const { database, team, line } = setup()

    const filed = await replyTo(
      database,
      team.id,
      { authorName: 'Iris', text: line.text, messageId: line.id },
      'Haz un resumen'
    )

    expect(filed.choice).toBeUndefined()
    expect(filed.task?.projectId).toBeNull()
  })

  it('gives the reply the project of the task that posted the quoted line', async () => {
    const { database, team, alpha, line } = setup()

    const filed = await replyTo(
      database,
      team.id,
      {
        authorName: 'Iris',
        text: line.text,
        messageId: line.id,
        sourceTask: { title: 'Flyer', prompt: 'Haz el flyer', projectId: alpha.id }
      },
      'Hazlo más corto'
    )

    expect(filed.choice).toBeUndefined()
    expect(filed.task?.projectId).toBe(alpha.id)
  })

  it('leaves the reply without a project when the quoted task’s project is no longer on the team', async () => {
    const { database, team, line } = setup()

    const filed = await replyTo(
      database,
      team.id,
      {
        authorName: 'Iris',
        text: line.text,
        messageId: line.id,
        sourceTask: { title: 'Flyer', prompt: 'Haz el flyer', projectId: 'botproject_gone' }
      },
      'Hazlo más corto'
    )

    expect(filed.choice).toBeUndefined()
    expect(filed.task?.projectId).toBeNull()
  })

  it('takes a project the reply names over the project of the quoted task', async () => {
    const { database, team, alpha, beta, line } = setup()

    const filed = await replyTo(
      database,
      team.id,
      {
        authorName: 'Iris',
        text: line.text,
        messageId: line.id,
        sourceTask: { title: 'Flyer', prompt: 'Haz el flyer', projectId: alpha.id }
      },
      'Hazlo para Beta'
    )

    expect(filed.task?.projectId).toBe(beta.id)
  })

  it('records on the task the message it answers', async () => {
    const { database, team, line } = setup()

    await replyTo(
      database,
      team.id,
      { authorName: 'Iris', text: line.text, messageId: line.id },
      'Haz un resumen'
    )

    const [task] = database.listBotTeamTasks(team.id)
    expect(task?.answersMessageId).toBe(line.id)
  })

  it('quotes the line in the task start notes', async () => {
    const { database, team, line } = setup()

    await replyTo(
      database,
      team.id,
      { authorName: 'Iris', text: line.text, messageId: line.id },
      'Haz un resumen'
    )

    const [task] = database.listBotTeamTasks(team.id)
    expect(database.getBotTeamTaskStartNotes(task.id)).toContain('Listo, el flyer está listo.')
  })

  it('still asks which project a request that is not a reply is for', async () => {
    const { database, team } = setup()

    const filed = await fileBotTeamRequest(
      database,
      { teamId: team.id, text: 'Haz un resumen', start: false, later: false, askProject: true },
      NOT_STARTED
    )

    expect(filed.choice).toMatchObject({ kind: 'project' })
    expect(database.listBotTeamTasks(team.id)).toEqual([])
  })
})
