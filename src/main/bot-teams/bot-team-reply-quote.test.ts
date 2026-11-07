import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botTeamReplyTarget } from './bot-team-reply-quote'

describe('botTeamReplyTarget', () => {
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
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Haz el flyer',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskProject(task.id, alpha.id)
    return { database: db, team, alpha, task }
  }

  it('quotes a bot line with its id and the task that posted it', () => {
    const { database, team, alpha, task } = setup()
    const line = database.postBotTeamMessage({
      teamId: team.id,
      authorBotId: team.bots[0].id,
      text: 'Listo',
      sourceTaskId: task.id
    })

    const target = botTeamReplyTarget(database, team, line.id)

    expect(target?.quote).toEqual({
      authorName: 'Iris',
      text: 'Listo',
      messageId: line.id,
      sourceTask: { title: 'Flyer', prompt: 'Haz el flyer', projectId: alpha.id }
    })
    expect(target?.bot?.id).toBe(team.bots[0].id)
  })

  it('quotes a person line with its id and no task', () => {
    const { database, team } = setup()
    const line = database.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Hola' })

    expect(botTeamReplyTarget(database, team, line.id)?.quote).toEqual({
      authorName: null,
      text: 'Hola',
      messageId: line.id
    })
  })
})
