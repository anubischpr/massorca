import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest, type BotTeamRequestFiling } from './bot-team-assign-request'

const NOT_STARTED = async (taskId: string): Promise<never> => {
  throw new Error(`Task ${taskId} should not start here.`)
}

describe('fileBotTeamRequest', () => {
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

  /** Files without starting, as a request saved to Todo: the defaults for every other field. */
  function file(
    database: OrchestrationDb,
    input: Pick<BotTeamRequestFiling, 'teamId' | 'text'> & Partial<BotTeamRequestFiling>
  ) {
    return fileBotTeamRequest(
      database,
      { start: false, later: false, askProject: false, ...input },
      NOT_STARTED
    )
  }

  it('files a task for the chosen bot of the same team', async () => {
    const { db, marketing } = setup()
    const max = marketing.bots[1]
    const { task } = await file(db, { teamId: marketing.id, text: 'Write a post', botId: max.id })
    expect(task).toMatchObject({
      teamId: marketing.id,
      ownerBotId: max.id,
      title: 'Write a post',
      prompt: 'Write a post',
      sessionId: null
    })
  })

  it('gives the least busy bot of the team a request with no bot chosen', async () => {
    const { db, marketing } = setup()
    const [iris, max] = marketing.bots
    const busy = db.createBotTeamTask({
      teamId: marketing.id,
      title: 'x',
      prompt: 'x',
      ownerBotId: iris.id
    })
    db.setBotTeamTaskSession(busy.id, 'session-1')
    const { task } = await file(db, { teamId: marketing.id, text: 'Write a post' })
    expect(task?.ownerBotId).toBe(max.id)
  })

  it('files the task in the receiving team, with one of its bots', async () => {
    const { db, marketing, warehouse } = setup()
    const { task } = await file(db, {
      teamId: marketing.id,
      toTeamId: warehouse.id,
      text: 'Check inventory'
    })
    expect(task).toMatchObject({ teamId: warehouse.id, ownerBotId: warehouse.bots[0].id })
    expect(db.listBotTeamTasks(marketing.id)).toEqual([])
  })

  it('refuses a bot that is not on the receiving team, and changes nothing', async () => {
    const { db, marketing, warehouse } = setup()
    await expect(
      file(db, {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        botId: marketing.bots[0].id,
        text: 'Check inventory'
      })
    ).rejects.toThrow(/not on team/)
    expect(db.listBotTeamTasks(warehouse.id)).toEqual([])
  })

  it('refuses a team with no bot, and a team that does not exist', async () => {
    const { db, marketing, empty } = setup()
    await expect(
      file(db, { teamId: marketing.id, toTeamId: empty.id, text: 'Anything' })
    ).rejects.toThrow('Empty has no bots yet.')
    await expect(
      file(db, { teamId: marketing.id, toTeamId: 'ghost', text: 'Anything' })
    ).rejects.toThrow('Team ghost was not found.')
  })
})
