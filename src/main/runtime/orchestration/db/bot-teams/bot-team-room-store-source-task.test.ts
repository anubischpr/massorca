import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('the task a room line came from', () => {
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
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Haz el flyer',
      ownerBotId: team.bots[0].id
    })
    return { database: db, team, task }
  }

  it('reads back the task a bot line came from, with the text unchanged', () => {
    const { database, team, task } = setup()

    const posted = database.postBotTeamMessage({
      teamId: team.id,
      authorBotId: team.bots[0].id,
      text: 'Listo',
      sourceTaskId: task.id
    })

    expect(posted).toMatchObject({ text: 'Listo', sourceTaskId: task.id })
    expect(database.listBotTeamMessages(team.id)).toEqual([
      expect.objectContaining({ text: 'Listo', sourceTaskId: task.id })
    ])
  })

  it('keeps the message a line answers and the task it came from together', () => {
    const { database, team, task } = setup()
    const person = database.postBotTeamMessage({
      teamId: team.id,
      authorBotId: null,
      text: 'Y el resumen?'
    })

    const posted = database.postBotTeamMessage({
      teamId: team.id,
      authorBotId: team.bots[0].id,
      text: 'Aquí está',
      replyToMessageId: person.id,
      sourceTaskId: task.id
    })

    expect(posted).toMatchObject({
      text: 'Aquí está',
      replyToMessageId: person.id,
      sourceTaskId: task.id
    })
  })

  it('leaves a line no task posted without a task id', () => {
    const { database, team } = setup()

    const posted = database.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Hola' })

    expect(posted).not.toHaveProperty('sourceTaskId')
  })
})
