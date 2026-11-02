import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'
import {
  BOT_TEAM_MEMORY_METHODS,
  botTeamDeleteMemoryMethod,
  botTeamListMemoryMethod
} from './bot-team-memory-methods'

describe('botTeams memory methods', () => {
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
      bots: [{ name: 'Iris', job: 'Designs', agent: 'claude' }]
    })
    const entry = db.addBotTeamMemory({
      teamId: team.id,
      botId: null,
      text: 'Closed on Monday',
      source: { kind: 'task', taskTitle: 'Flyer' }
    })
    const ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext
    return { team, entry, ctx }
  }

  it('lists what the team remembers, with its source', async () => {
    const { team, entry, ctx } = setup()
    const result = await botTeamListMemoryMethod.handler({ teamId: team.id }, ctx)
    expect(result).toEqual({ memory: [entry] })
  })

  it('deletes a line for good, and says when there was nothing to delete', async () => {
    const { team, entry, ctx } = setup()
    const remove = botTeamDeleteMemoryMethod
    expect(await remove.handler({ memoryId: entry.id }, ctx)).toEqual({ deleted: true })
    expect(await remove.handler({ memoryId: entry.id }, ctx)).toEqual({ deleted: false })
    expect(db?.listBotTeamMemory(team.id)).toEqual([])
  })

  it('are workspace methods that need an id', () => {
    for (const method of BOT_TEAM_MEMORY_METHODS) {
      expect(method.permission).toBe('workspace')
    }
    expect(() => botTeamDeleteMemoryMethod.params?.parse({})).toThrow()
  })
})
