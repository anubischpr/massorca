import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const askBot = vi.hoisted(() =>
  vi.fn(
    async (_args: {
      agent: { id: string } | null
      prompt: string
      research?: boolean
    }): Promise<string | null> => 'Hola'
  )
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(),
  askBotAgentForBotTeamReply: askBot
}))

import { startBotTeamConversationReply } from './bot-team-conversation-reply'
import { listBotTeamReplying } from './bot-team-reply-in-flight'

describe('startBotTeamConversationReply', () => {
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
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'Hola',
      subjectBotIds: []
    })?.done
    expect(askBot.mock.calls[0][0].agent).toBeNull()
    expect(posted?.authorBotId).toBe(team.bots[0].id)
  })

  it('runs a Claude bot on its own agent, and still answers when the usage meter is unreadable', async () => {
    const { team, ctx } = setup('claude')
    await startBotTeamConversationReply(ctx, { team, text: 'Hola', subjectBotIds: [] })?.done
    expect(askBot.mock.calls[0][0].agent).toMatchObject({ id: 'claude' })
  })

  it('answers nothing for a team with no bots', async () => {
    const { team, ctx } = setup('claude')
    const started = startBotTeamConversationReply(ctx, {
      team: { ...team, bots: [] },
      text: 'Hola',
      subjectBotIds: []
    })
    expect(started).toBeNull()
    expect(askBot).not.toHaveBeenCalled()
  })

  it('names the replying bot at once, keeps it listed until the reply is posted, then clears it', async () => {
    const { team, ctx } = setup('claude')
    let release: (text: string) => void = () => {}
    askBot.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const started = startBotTeamConversationReply(ctx, { team, text: 'Hola', subjectBotIds: [] })
    expect(started?.botId).toBe(team.bots[0].id)
    expect(listBotTeamReplying(team.id)).toEqual([
      { botId: team.bots[0].id, since: expect.any(Number) }
    ])
    expect(db?.listBotTeamMessages(team.id)).toEqual([])
    release('Listo')
    await started?.done
    expect(listBotTeamReplying(team.id)).toEqual([])
    expect(db?.listBotTeamMessages(team.id).map((message) => message.text)).toEqual(['Listo'])
  })

  it('posts one line from the team when nothing could answer, and clears the reply', async () => {
    const { team, ctx } = setup('claude')
    askBot.mockResolvedValueOnce(null)
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'Can you check this?',
      subjectBotIds: []
    })?.done
    expect(posted).toMatchObject({
      authorBotId: 'all',
      text: 'No one could answer that just now. Mention a bot with @ to ask again.'
    })
    expect(listBotTeamReplying(team.id)).toEqual([])
  })

  it('also posts the line, and clears the reply, when the query throws', async () => {
    const { team, ctx } = setup('claude')
    askBot.mockRejectedValueOnce(new Error('boom'))
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'Hola',
      subjectBotIds: []
    })?.done
    expect(posted?.authorBotId).toBe('all')
    expect(listBotTeamReplying(team.id)).toEqual([])
  })

  it('asks a research question with web search, without the room history, and keeps the links', async () => {
    const { team, ctx } = setup('claude')
    db?.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Secret old talk' })
    askBot.mockResolvedValueOnce('Respuesta. Sources: https://example.com/jev')
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'Qué es Jev AI?',
      subjectBotIds: [],
      research: true
    })?.done
    expect(askBot.mock.calls[0][0].research).toBe(true)
    expect(askBot.mock.calls[0][0].prompt).not.toContain('Secret old talk')
    expect(posted?.text).toContain('https://example.com/jev')
  })

  it('keeps a plain question text-only', async () => {
    const { team, ctx } = setup('claude')
    await startBotTeamConversationReply(ctx, { team, text: 'Hola', subjectBotIds: [] })?.done
    expect(askBot.mock.calls[0][0].research).toBeFalsy()
  })
})
