import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest } from './bot-team-assign-request'
import { returnUnstartedBotTeamTask } from './bot-team-return'

describe('a request another team asked for that cannot start', () => {
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
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const warehouse = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: '', agent: 'claude' }]
    })
    const asked = db.postBotTeamMessage({
      teamId: marketing.id,
      text: '@Warehouse count the boxes',
      authorBotId: null
    })
    return { db, marketing, warehouse, asked }
  }

  const refused = async (): Promise<never> => {
    throw new Error('The bot is busy.')
  }

  it('tells the asking room once that the task did not start, with the reason', async () => {
    const { db, marketing, warehouse, asked } = setup()

    const { task, startError } = await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Count the boxes',
        start: true,
        later: false,
        askProject: false,
        originMessageId: asked.id
      },
      refused
    )

    expect(startError).toBe('The bot is busy.')
    expect(task?.sessionId).toBeNull()
    const returned = db
      .listBotTeamMessages(marketing.id)
      .filter((m) => m.fromTeamId === warehouse.id)
    expect(returned).toHaveLength(1)
    expect(returned[0].authorBotId).toBe(warehouse.bots[0].id)
    expect(returned[0].text).toContain(`Bea could not start "${task?.title}".`)
    expect(returned[0].text).toContain('The bot is busy.')
  })

  it('answers in the language of the request', async () => {
    const { db, marketing, warehouse, asked } = setup()

    await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Cuenta las cajas de los flyers',
        start: true,
        later: false,
        askProject: false,
        originMessageId: asked.id
      },
      refused
    )

    const returned = db
      .listBotTeamMessages(marketing.id)
      .filter((m) => m.fromTeamId === warehouse.id)
    expect(returned).toHaveLength(1)
    expect(returned[0].text).toContain('Bea no pudo iniciar')
  })

  it('stays silent for a request kept in Todo on purpose', async () => {
    const { db, marketing, warehouse, asked } = setup()

    await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Count the boxes',
        start: false,
        later: false,
        askProject: false,
        originMessageId: asked.id
      },
      refused
    )
    await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Count the boxes',
        start: true,
        later: true,
        askProject: false,
        originMessageId: asked.id
      },
      refused
    )

    expect(db.listBotTeamMessages(marketing.id).filter((m) => m.fromTeamId)).toEqual([])
  })

  it('stays silent when the request stayed in the same team', async () => {
    const { db, marketing } = setup()

    await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        text: 'Count the boxes',
        start: true,
        later: false,
        askProject: false
      },
      refused
    )

    expect(db.listBotTeamMessages(marketing.id).filter((m) => m.fromTeamId)).toEqual([])
  })

  it('posts once when the same unstarted task is reported again', async () => {
    const { db, marketing, warehouse, asked } = setup()
    const filing = await fileBotTeamRequest(
      db,
      {
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Count the boxes',
        start: false,
        later: false,
        askProject: false,
        originMessageId: asked.id
      },
      refused
    )

    if (filing.task === null) {
      throw new Error('The request was not filed.')
    }
    returnUnstartedBotTeamTask(db, filing.task.id, 'The bot is busy.')
    returnUnstartedBotTeamTask(db, filing.task.id, 'The bot is busy.')

    expect(
      db.listBotTeamMessages(marketing.id).filter((m) => m.fromTeamId === warehouse.id)
    ).toHaveLength(1)
  })
})
