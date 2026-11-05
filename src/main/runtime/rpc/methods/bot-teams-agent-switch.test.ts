import '../unused-default-rpc-methods.test-fixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppId } from '../../../../shared/marketplace-apps'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RpcRequest } from '../core'
import { RpcDispatcher } from '../dispatcher'
import { BOT_TEAM_METHODS } from './bot-teams'

const denial = vi.hoisted(() => ({ ids: [] as MarketplaceAppId[] }))
vi.mock('../../../marketplace/marketplace-bot-run-denial', () => ({
  deniedMarketplaceAppIdsForBot: vi.fn(async () => denial.ids)
}))

const TEAM = {
  id: 't1',
  name: 'Team',
  bots: [
    { id: 'bob', name: 'Bob', agent: 'claude' },
    { id: 'ana', name: 'Ana', agent: 'antigravity' }
  ]
}

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

function dispatcherWithDb(): {
  dispatcher: RpcDispatcher
  db: Record<string, ReturnType<typeof vi.fn>>
} {
  const db = {
    listBotTeams: vi.fn(() => [TEAM]),
    updateBotOnTeam: vi.fn(() => TEAM),
    addBotToTeam: vi.fn(() => TEAM),
    createBotTeam: vi.fn(() => TEAM)
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the bot-team handlers read only getOrchestrationDb.
  const runtime = {
    getRuntimeId: () => 'test-runtime',
    getOrchestrationDb: () => db
  } as unknown as OrcaRuntimeService
  return { dispatcher: new RpcDispatcher({ runtime, methods: BOT_TEAM_METHODS }), db }
}

const ON_ANTIGRAVITY = { name: 'Bob', agent: 'antigravity' }

describe('bot team methods and the Antigravity switch', () => {
  beforeEach(() => {
    denial.ids = []
  })

  it.each([
    ['botTeams.updateBot', { teamId: 't1', botId: 'bob', bot: ON_ANTIGRAVITY }, 'updateBotOnTeam'],
    ['botTeams.addBot', { teamId: 't1', bot: ON_ANTIGRAVITY }, 'addBotToTeam'],
    [
      'botTeams.create',
      { name: 'New', character: 'square', bots: [ON_ANTIGRAVITY] },
      'createBotTeam'
    ]
  ])('%s refuses a blocked bot on Antigravity and saves nothing', async (method, params, write) => {
    denial.ids = ['engram']
    const { dispatcher, db } = dispatcherWithDb()
    const response = await dispatcher.dispatch(makeRequest(method, params))
    expect(response).toMatchObject({ ok: false })
    expect(JSON.stringify(response)).toContain('this bot is blocked from Engram')
    expect(db[write]).not.toHaveBeenCalled()
  })

  it.each([
    ['a bot blocked from nothing', [], { teamId: 't1', botId: 'bob', bot: ON_ANTIGRAVITY }],
    [
      'an edit of a bot already on Antigravity',
      ['engram'],
      { teamId: 't1', botId: 'ana', bot: { name: 'Ana', agent: 'antigravity' } }
    ],
    [
      'another agent',
      ['engram'],
      { teamId: 't1', botId: 'bob', bot: { name: 'Bob', agent: 'codex' } }
    ]
  ])('saves %s', async (_case, ids, params) => {
    denial.ids = ids as MarketplaceAppId[]
    const { dispatcher, db } = dispatcherWithDb()
    const response = await dispatcher.dispatch(makeRequest('botTeams.updateBot', params))
    expect(response).toMatchObject({ ok: true, result: { team: TEAM } })
    expect(db.updateBotOnTeam).toHaveBeenCalledTimes(1)
  })
})
