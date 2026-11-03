import { afterEach, describe, expect, it, vi } from 'vitest'
import { BotTeamMessagePost } from '../../../../shared/rpc-contract/bot-team-room-params'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(async () => null),
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

describe('a room message of only files', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  it('is accepted with files and refused without any text or file', () => {
    expect(
      BotTeamMessagePost.safeParse({ teamId: 't', text: '', attachments: [FLYER] }).success
    ).toBe(true)
    expect(BotTeamMessagePost.safeParse({ teamId: 't', text: '' }).success).toBe(false)
    expect(BotTeamMessagePost.safeParse({ teamId: 't', text: '  ', attachments: [] }).success).toBe(
      false
    )
    expect(BotTeamMessagePost.safeParse({ teamId: 't', text: 'hi' }).success).toBe(true)
  })

  async function post(earlier: string) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    db.postBotTeamMessage({ teamId: team.id, text: earlier, authorBotId: null })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    const result = await postBotTeamRequestOnHost(
      ctx,
      { teamId: team.id, text: '', start: false, attachments: [FLYER] },
      async () => {
        throw new Error('not started')
      }
    )
    return result
  }

  it('is filed as a request that names the files, in the language the person wrote before', async () => {
    const result = await post('Hazme el flyer para la semana que viene, por favor')
    expect(result.message.text).toContain('Archivos adjuntos: flyer.png')
    expect(result.message.attachments).toEqual([FLYER])
    expect(result.task?.prompt).toContain('Archivos adjuntos: flyer.png')
  })

  it('names the files in English when the earlier lines are English', async () => {
    const result = await post('Make the flyer for next week, please')
    expect(result.message.text).toContain('Files attached: flyer.png')
  })
})
