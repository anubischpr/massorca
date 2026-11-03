import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'
import { BOT_TEAM_ROOM_METHODS } from './bot-team-room'

describe('botTeams.listRoom sent requests', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  it('lists the tasks other teams hold for this room, and none for the other room', async () => {
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
      title: 'Count',
      prompt: 'Count',
      ownerBotId: b.bots[0].id
    })
    db.setBotTeamTaskOrigin(task.id, a.id, null)
    const method = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.listRoom')
    const ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext

    const fromA = (await method?.handler({ teamId: a.id }, ctx)) as { sentRequests: unknown[] }
    const fromB = (await method?.handler({ teamId: b.id }, ctx)) as { sentRequests: unknown[] }

    expect(fromA.sentRequests).toEqual([
      { task: expect.objectContaining({ id: task.id, teamId: b.id }), messageId: null }
    ])
    expect(fromB.sentRequests).toEqual([])
  })
})
