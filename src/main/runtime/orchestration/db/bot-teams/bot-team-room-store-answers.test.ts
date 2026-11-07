import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('the room message a reply task answers', () => {
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

  it('lists the message on the task that answers it, from the task and the team alike', () => {
    const { database, team, task } = setup()
    const person = database.postBotTeamMessage({
      teamId: team.id,
      authorBotId: null,
      text: 'Y el resumen?'
    })

    database.setBotTeamTaskAnswers(task.id, person.id)

    expect(database.getBotTeamTask(task.id)).toMatchObject({ answersMessageId: person.id })
    expect(database.listBotTeamTasks(team.id)).toEqual([
      expect.objectContaining({ id: task.id, answersMessageId: person.id })
    ])
  })

  it('leaves a task that answers no message without one', () => {
    const { database, team } = setup()

    const [listed] = database.listBotTeamTasks(team.id)

    expect(listed).not.toHaveProperty('answersMessageId')
  })
})
