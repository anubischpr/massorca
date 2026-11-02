import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'
import { botTeamAssignMethods } from './bot-team-assign-methods'

describe('botTeams.assignRequest', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup(
    startTask = vi.fn(async (_ctx: RpcContext, taskId: string) => db!.getBotTeamTask(taskId))
  ) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    const method = botTeamAssignMethods(startTask)[0]
    const ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext
    return { team, method, ctx, startTask }
  }

  it('is a workspace method that parses a start flag defaulting to true', () => {
    const { method, team } = setup()
    expect(method.permission).toBe('workspace')
    expect(method.params?.parse({ teamId: team.id, text: 'Do it' })).toMatchObject({ start: true })
  })

  it('files the task and starts it', async () => {
    const { method, ctx, team, startTask } = setup()
    const result = await method.handler(
      { teamId: team.id, text: 'Make a flyer', botId: team.bots[0].id, start: true },
      ctx
    )
    expect(startTask).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ task: { title: 'Make a flyer' }, startError: null })
  })

  it('keeps a task it could not start in Todo and says why', async () => {
    const { method, ctx, team } = setup(vi.fn(async () => Promise.reject(new Error('No host'))))
    const result = await method.handler({ teamId: team.id, text: 'Make a flyer', start: true }, ctx)
    expect(result).toMatchObject({ task: { sessionId: null }, startError: 'No host' })
    expect(db?.listBotTeamTasks(team.id)).toHaveLength(1)
  })

  it('does not start a task when asked to only save it', async () => {
    const { method, ctx, team, startTask } = setup()
    await method.handler({ teamId: team.id, text: 'Later', start: false }, ctx)
    expect(startTask).not.toHaveBeenCalled()
  })
})
