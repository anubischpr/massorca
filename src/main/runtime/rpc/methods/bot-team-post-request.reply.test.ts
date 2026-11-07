import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const classify = vi.hoisted(() => vi.fn(async () => '{"kind":"bot","bots":["Bea"]}'))

vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: classify,
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

describe('a room request that replies to a message', () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => classify.mockClear())
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    const database = new OrchestrationDb(':memory:')
    db = database
    const team = database.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Ana', job: 'Writer', agent: 'claude' },
        { name: 'Bea', job: 'Designer', agent: 'claude' }
      ]
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => database,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    const botNamed = (name: string) => team.bots.find((bot) => bot.name === name)!.id
    return { database, team, ctx, botNamed }
  }

  async function post(
    setupResult: ReturnType<typeof setup>,
    text: string,
    replyToMessageId?: string
  ) {
    let notesAtStart: string | null = null
    const result = await postBotTeamRequestOnHost(
      setupResult.ctx,
      {
        teamId: setupResult.team.id,
        text,
        start: true,
        ...(replyToMessageId ? { replyToMessageId } : {})
      },
      async (taskId) => {
        notesAtStart = setupResult.database.getBotTeamTaskStartNotes(taskId)
        return setupResult.database.getBotTeamTask(taskId)
      }
    )
    return { result, notesAtStart }
  }

  it('files the request to the bot whose message it replies to, quoting that message', async () => {
    const env = setup()
    const quoted = env.database.postBotTeamMessage({
      teamId: env.team.id,
      authorBotId: env.botNamed('Ana'),
      text: 'Nadie lanza el viernes por la mañana.'
    })
    const { result, notesAtStart } = await post(env, 'Y si el viernes cambia?', quoted.id)
    expect(classify).not.toHaveBeenCalled()
    expect(result.task?.ownerBotId).toBe(env.botNamed('Ana'))
    expect(notesAtStart).toContain('Nadie lanza el viernes por la mañana.')
    expect(result.message.replyToMessageId).toBe(quoted.id)
    expect(env.database.listBotTeamMessages(env.team.id)[1]).toMatchObject({
      text: 'Y si el viernes cambia?',
      replyToMessageId: quoted.id
    })
  })

  it('lets an explicit mention of another bot win over the quoted bot', async () => {
    const env = setup()
    const quoted = env.database.postBotTeamMessage({
      teamId: env.team.id,
      authorBotId: env.botNamed('Ana'),
      text: 'Nadie lanza el viernes por la mañana.'
    })
    const { result } = await post(env, '@Bea haz el texto del viernes', quoted.id)
    expect(result.task?.ownerBotId).toBe(env.botNamed('Bea'))
  })

  it("falls back to the default routing when the quoted message is the person's own", async () => {
    const env = setup()
    const own = env.database.postBotTeamMessage({
      teamId: env.team.id,
      authorBotId: null,
      text: 'Quiero un flyer para el viernes'
    })
    const { result, notesAtStart } = await post(env, 'Hazlo más corto', own.id)
    expect(classify).toHaveBeenCalledTimes(1)
    expect(result.task?.ownerBotId).toBe(env.botNamed('Bea'))
    expect(notesAtStart).toContain('Quiero un flyer para el viernes')
  })

  it('ignores a message that belongs to another team', async () => {
    const env = setup()
    const other = env.database.createBotTeam({
      name: 'Other',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Cy', job: 'Analyst', agent: 'claude' }]
    })
    const foreign = env.database.postBotTeamMessage({
      teamId: other.id,
      authorBotId: other.bots[0]!.id,
      text: 'Texto ajeno a esta sala'
    })
    const { result, notesAtStart } = await post(env, 'Haz un flyer', foreign.id)
    expect(classify).toHaveBeenCalledTimes(1)
    expect(result.task?.ownerBotId).toBe(env.botNamed('Bea'))
    expect(notesAtStart ?? '').not.toContain('Texto ajeno a esta sala')
    expect(result.message).not.toHaveProperty('replyToMessageId')
  })

  it('asks the bot the person replied to when the reply has only files, and files nothing', async () => {
    const env = setup()
    const quoted = env.database.postBotTeamMessage({
      teamId: env.team.id,
      authorBotId: env.botNamed('Ana'),
      text: 'Nadie lanza el viernes por la mañana.'
    })
    const result = await postBotTeamRequestOnHost(
      env.ctx,
      {
        teamId: env.team.id,
        text: '',
        start: true,
        attachments: [FLYER],
        replyToMessageId: quoted.id
      },
      async () => {
        throw new Error('not started')
      }
    )
    expect(classify).not.toHaveBeenCalled()
    expect(result.task).toBeNull()
    expect(env.database.listBotTeamMessages(env.team.id).at(-1)).toMatchObject({
      authorBotId: env.botNamed('Ana'),
      text: 'What do you want me to do with flyer.png?'
    })
  })
})
