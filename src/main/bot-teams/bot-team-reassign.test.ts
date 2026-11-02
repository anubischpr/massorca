import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { reassignBotTeamTask } from './bot-team-reassign'

describe('reassignBotTeamTask', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const marketing = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Iris', job: 'Designs flyers', agent: 'claude' },
        { name: 'Max', job: 'Writes copy', agent: 'claude' }
      ]
    })
    const warehouse = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: 'Counts stock', agent: 'claude' }]
    })
    const [iris, max] = marketing.bots
    db.postBotTeamMessage({ teamId: marketing.id, text: 'Count the boxes', authorBotId: null })
    db.postBotTeamMessage({ teamId: marketing.id, text: 'Taking this on', authorBotId: iris.id })
    db.postBotTeamMessage({ teamId: marketing.id, text: 'Counted 40 so far', authorBotId: iris.id })
    db.postBotTeamMessage({ teamId: marketing.id, text: 'Not mine', authorBotId: max.id })
    const task = db.createBotTeamTask({
      teamId: marketing.id,
      title: 'Count the boxes',
      prompt: 'Count the boxes',
      ownerBotId: iris.id
    })
    return { db, marketing, warehouse, iris, max, task }
  }

  it('gives the task to a bot of another team, who reads what the old owner posted', () => {
    const { db, warehouse, iris, task } = setup()
    db.setBotTeamTaskSession(task.id, 'session-1')
    const moved = reassignBotTeamTask(db, { taskId: task.id, botId: warehouse.bots[0].id })
    expect(moved).toMatchObject({
      teamId: warehouse.id,
      ownerBotId: warehouse.bots[0].id,
      sessionId: null
    })
    const notes = db.getBotTeamTaskStartNotes(task.id) ?? ''
    expect(notes).toContain(`${iris.name}`)
    expect(notes).toContain('Marketing')
    expect(notes).toContain('- Taking this on')
    expect(notes).toContain('- Counted 40 so far')
    expect(notes).not.toContain('Not mine')
  })

  it('says a task that never started was not started', () => {
    const { db, warehouse, task } = setup()
    reassignBotTeamTask(db, { taskId: task.id, botId: warehouse.bots[0].id })
    expect(db.getBotTeamTaskStartNotes(task.id)).toContain('had not been started')
  })

  it('keeps the task in its team and project when another bot of the team takes it', () => {
    const { db, marketing, max, task } = setup()
    const project = db.createBotTeamProject({
      teamId: marketing.id,
      name: 'Summer',
      goal: '',
      codeSource: null
    })
    db.setBotTeamTaskProject(task.id, project.id)
    const moved = reassignBotTeamTask(db, { taskId: task.id, botId: max.id })
    expect(moved).toMatchObject({ teamId: marketing.id, ownerBotId: max.id, projectId: project.id })
  })

  it('refuses the bot that already owns it, an unknown bot, and a task handed to a teammate', () => {
    const { db, iris, task } = setup()
    expect(() => reassignBotTeamTask(db, { taskId: task.id, botId: iris.id })).toThrow(
      'Iris already owns this task.'
    )
    expect(() => reassignBotTeamTask(db, { taskId: task.id, botId: 'ghost' })).toThrow(
      'Bot ghost was not found.'
    )
    expect(db.getBotTeamTask(task.id).ownerBotId).toBe(iris.id)
  })
})
