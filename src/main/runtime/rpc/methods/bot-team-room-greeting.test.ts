import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const askRequest = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null))
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: askRequest,
  askBotAgentForBotTeamReply: vi.fn(async (): Promise<string | null> => null)
}))

import { BOT_TEAM_ROOM_METHODS } from './bot-team-room'

describe('botTeams.postMessage greeting', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    askRequest.mockClear()
  })

  async function post(text: string) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Iris', job: 'Designs flyers', agent: 'claude' },
        { name: 'Max', job: 'Writes copy', agent: 'claude' }
      ]
    })
    const method = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.postMessage')
    const ctx = {
      runtime: { getOrchestrationDb: () => db, getClientSettings: () => ({}) }
    } as unknown as RpcContext
    const result = await method?.handler({ teamId: team.id, text, start: false }, ctx)
    return { team, result }
  }

  it('stores the person line and one reply from All, with no query and no task', async () => {
    const { team, result } = await post('Hola!')
    expect(askRequest).not.toHaveBeenCalled()
    expect(result).toMatchObject({ task: null, greeted: true })
    expect(db?.listBotTeamTasks(team.id)).toEqual([])
    expect(db?.listBotTeamMessages(team.id).map((message) => message.authorBotId)).toEqual([
      null,
      'all'
    ])
  })

  it('routes a request that starts with a greeting as usual', async () => {
    const { team, result } = await post('Hola, haz un flyer')
    expect(askRequest).toHaveBeenCalledTimes(1)
    expect(result).not.toHaveProperty('greeted')
    expect(db?.listBotTeamMessages(team.id)).toHaveLength(1)
  })
})
