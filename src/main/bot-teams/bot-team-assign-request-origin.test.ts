import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest } from './bot-team-assign-request'

describe('fileBotTeamRequest origin', () => {
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
    return { db, marketing, warehouse }
  }

  const base = { start: false, later: false, askProject: false }
  const NOT_STARTED = async (): Promise<never> => {
    throw new Error('not started')
  }

  it('remembers the asking team and message on a task sent to another team', async () => {
    const { db, marketing, warehouse } = setup()
    const asked = db.postBotTeamMessage({ teamId: marketing.id, text: 'x', authorBotId: null })

    const { task } = await fileBotTeamRequest(
      db,
      {
        ...base,
        teamId: marketing.id,
        toTeamId: warehouse.id,
        text: 'Count boxes',
        originMessageId: asked.id
      },
      NOT_STARTED
    )

    expect(db.getBotTeamTaskOrigin(task!.id)).toEqual({ teamId: marketing.id, messageId: asked.id })
    expect(db.listBotTeamSentRequests(marketing.id)).toHaveLength(1)
  })

  it('keeps a choice card answer, which names no message, under the person line that asked', async () => {
    const { db, marketing, warehouse } = setup()
    const asked = db.postBotTeamMessage({
      teamId: marketing.id,
      text: 'Count boxes',
      authorBotId: null
    })
    db.postBotTeamMessage({
      teamId: marketing.id,
      text: 'Count boxes',
      authorBotId: marketing.bots[0].id
    })

    const { task } = await fileBotTeamRequest(
      db,
      { ...base, teamId: marketing.id, toTeamId: warehouse.id, text: 'Count boxes' },
      NOT_STARTED
    )

    expect(db.getBotTeamTaskOrigin(task!.id)).toEqual({ teamId: marketing.id, messageId: asked.id })
  })

  it('keeps no origin on a task a team files for itself', async () => {
    const { db, marketing } = setup()

    const { task } = await fileBotTeamRequest(
      db,
      { ...base, teamId: marketing.id, text: 'Write a post' },
      NOT_STARTED
    )

    expect(db.getBotTeamTaskOrigin(task!.id)).toBeNull()
  })
})
