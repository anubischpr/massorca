import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const askBot = vi.hoisted(() =>
  vi.fn(async (_args: { agent: { id: string } | null }): Promise<string | null> => 'Hola')
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(),
  askBotAgentForBotTeamReply: askBot
}))

import { replyToBotTeamConversation } from './bot-team-conversation-reply'

describe('replyToBotTeamConversation', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    askBot.mockClear()
  })

  function setup(agent: 'pi' | 'claude') {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Rosa', job: 'Writes', agent }]
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => {
          throw new Error('no meter')
        },
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    return { team, ctx }
  }

  it('never runs Gentle Shell as stock Pi: its reply goes to the default agent', async () => {
    const { team, ctx } = setup('pi')
    const posted = await replyToBotTeamConversation(ctx, { team, text: 'Hola', subjectBotIds: [] })
    expect(askBot.mock.calls[0][0].agent).toBeNull()
    expect(posted?.authorBotId).toBe(team.bots[0].id)
  })

  it('runs a Claude bot on its own agent, and still answers when the usage meter is unreadable', async () => {
    const { team, ctx } = setup('claude')
    await replyToBotTeamConversation(ctx, { team, text: 'Hola', subjectBotIds: [] })
    expect(askBot.mock.calls[0][0].agent).toMatchObject({ id: 'claude' })
  })

  it('answers nothing for a team with no bots', async () => {
    const { team, ctx } = setup('claude')
    const reply = await replyToBotTeamConversation(ctx, {
      team: { ...team, bots: [] },
      text: 'Hola',
      subjectBotIds: []
    })
    expect(reply).toBeNull()
    expect(askBot).not.toHaveBeenCalled()
  })
})
