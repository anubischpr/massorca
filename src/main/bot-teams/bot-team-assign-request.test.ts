import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { assignBotTeamRequest } from './bot-team-assign-request'

describe('assignBotTeamRequest', () => {
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
      purpose: 'Inventory',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: 'Counts stock', agent: 'claude' }]
    })
    const empty = db.createBotTeam({
      name: 'Empty',
      purpose: '',
      character: 'blob',
      workspacesEnabled: false,
      bots: []
    })
    return { db, marketing, warehouse, empty }
  }

  it('files a task for the chosen bot of the same team', () => {
    const { db, marketing } = setup()
    const max = marketing.bots[1]
    const task = assignBotTeamRequest(db, {
      teamId: marketing.id,
      text: 'Write a post',
      botId: max.id
    })
    expect(task).toMatchObject({
      teamId: marketing.id,
      ownerBotId: max.id,
      title: 'Write a post',
      prompt: 'Write a post',
      sessionId: null
    })
  })

  it('gives the least busy bot of the team a request with no bot chosen', () => {
    const { db, marketing } = setup()
    const [iris, max] = marketing.bots
    const busy = db.createBotTeamTask({
      teamId: marketing.id,
      title: 'x',
      prompt: 'x',
      ownerBotId: iris.id
    })
    db.setBotTeamTaskSession(busy.id, 'session-1')
    const task = assignBotTeamRequest(db, { teamId: marketing.id, text: 'Write a post' })
    expect(task.ownerBotId).toBe(max.id)
  })

  it('files the task in the receiving team, with one of its bots', () => {
    const { db, marketing, warehouse } = setup()
    const task = assignBotTeamRequest(db, {
      teamId: marketing.id,
      toTeamId: warehouse.id,
      text: 'Check inventory'
    })
    expect(task).toMatchObject({ teamId: warehouse.id, ownerBotId: warehouse.bots[0].id })
    expect(db.listBotTeamTasks(marketing.id)).toEqual([])
  })

  it('refuses a bot that is not on the receiving team, and changes nothing', () => {
    const { db, marketing, warehouse } = setup()
    expect(() =>
      assignBotTeamRequest(db, {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        botId: marketing.bots[0].id,
        text: 'Check inventory'
      })
    ).toThrow(/not on team/)
    expect(db.listBotTeamTasks(warehouse.id)).toEqual([])
  })

  it('refuses a team with no bot, and a team that does not exist', () => {
    const { db, marketing, empty } = setup()
    expect(() =>
      assignBotTeamRequest(db, { teamId: marketing.id, toTeamId: empty.id, text: 'Anything' })
    ).toThrow('Empty has no bots yet.')
    expect(() =>
      assignBotTeamRequest(db, { teamId: marketing.id, toTeamId: 'ghost', text: 'Anything' })
    ).toThrow('Team ghost was not found.')
  })
})
