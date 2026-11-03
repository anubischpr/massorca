import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team tracker store', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const a = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const b = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: b.id,
      title: 'Count boxes',
      prompt: 'Count boxes',
      ownerBotId: b.bots[0].id
    })
    return { db, a, b, task }
  }

  it('remembers who asked for a task and lists the requests a team sent', () => {
    const { db, a, b, task } = setup()
    const asked = db.postBotTeamMessage({
      teamId: a.id,
      text: '@Warehouse count',
      authorBotId: null
    })

    db.setBotTeamTaskOrigin(task.id, a.id, asked.id)

    expect(db.getBotTeamTaskOrigin(task.id)).toEqual({ teamId: a.id, messageId: asked.id })
    expect(db.listBotTeamSentRequests(a.id)).toEqual([
      { task: expect.objectContaining({ id: task.id, teamId: b.id }), messageId: asked.id }
    ])
    expect(db.listBotTeamSentRequests(b.id)).toEqual([])
  })

  it('posts a returned message once per task, from a bot of the other team', () => {
    const { db, a, b, task } = setup()
    const files = [{ path: 'attachments/from-warehouse-boxes.xlsx', name: 'boxes.xlsx' }]

    const first = db.postBotTeamReturn({
      teamId: a.id,
      fromTeamId: b.id,
      fromTaskId: task.id,
      authorBotId: b.bots[0].id,
      text: 'Counted 42 boxes.',
      attachments: files
    })
    const second = db.postBotTeamReturn({
      teamId: a.id,
      fromTeamId: b.id,
      fromTaskId: task.id,
      authorBotId: b.bots[0].id,
      text: 'again',
      attachments: []
    })

    expect(first).not.toBeNull()
    expect(second).toBeNull()
    expect(db.hasBotTeamReturn(task.id)).toBe(true)
    expect(db.listBotTeamMessages(a.id)).toEqual([
      expect.objectContaining({
        text: 'Counted 42 boxes.',
        authorBotId: b.bots[0].id,
        fromTeamId: b.id,
        attachments: files
      })
    ])
  })
})
