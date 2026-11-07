import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import { BotTeamMessagePost } from '../../../../shared/rpc-contract/bot-team-room-params'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const classify = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null))

vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: classify,
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }
const LOGO = { path: 'attachments/logo.png', name: 'logo.png' }

describe('a room message of only files', () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => classify.mockClear())
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

  function setup(earlier: string) {
    const database = new OrchestrationDb(':memory:')
    db = database
    const team = database.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    if (earlier !== '') {
      database.postBotTeamMessage({ teamId: team.id, text: earlier, authorBotId: null })
    }
    const ctx = {
      runtime: {
        getOrchestrationDb: () => database,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    return { database, team, ctx, iris: team.bots[0]! }
  }

  type Env = ReturnType<typeof setup>
  const post = (env: Env, text: string, attachments: BotTeamRoomAttachment[] = [], start = false) =>
    postBotTeamRequestOnHost(
      env.ctx,
      { teamId: env.team.id, text, start, attachments },
      async () => {
        throw new Error('not started')
      }
    )

  it('asks the bot what to do with the files instead of filing them', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    const result = await post(env, '', [FLYER])
    expect(result.message.text).toContain('Archivos adjuntos: flyer.png')
    expect(result.message.attachments).toEqual([FLYER])
    expect(result.task).toBeNull()
    expect(result.answered).toBe(true)
    expect(env.database.listBotTeamTasks(env.team.id)).toEqual([])
    expect(classify).not.toHaveBeenCalled()
    expect(env.database.listBotTeamMessages(env.team.id).at(-1)).toMatchObject({
      authorBotId: env.iris.id,
      text: '¿Qué quieres que haga con flyer.png?'
    })
  })

  it('asks in English when the earlier lines are English', async () => {
    const env = setup('Make the flyer for next week, please')
    await post(env, '', [FLYER])
    expect(env.database.listBotTeamMessages(env.team.id).at(-1)?.text).toBe(
      'What do you want me to do with flyer.png?'
    )
  })

  it('asks by the bot the person mentioned when the mention is the only words', async () => {
    const env = setup('Hazme el flyer')
    const result = await post(env, '@Iris', [FLYER])
    expect(result.task).toBeNull()
    expect(classify).not.toHaveBeenCalled()
    expect(env.database.listBotTeamMessages(env.team.id).at(-1)).toMatchObject({
      authorBotId: env.iris.id,
      text: '¿Qué quieres que haga con flyer.png?'
    })
  })

  it('files a message with words and files as a request, keeping its words', async () => {
    const env = setup('Hazme el flyer')
    const result = await post(env, 'Haz el flyer para el viernes', [FLYER])
    expect(result.task?.prompt).toBe('Haz el flyer para el viernes')
    expect(env.database.getBotTeamTaskStartNotes(result.task!.id)).toContain(
      'Files attached to the team folder: attachments/flyer.png'
    )
  })

  it('carries the files the room asked about into the next line that gives the instruction', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    await post(env, '', [FLYER])
    const result = await post(env, 'Resúmelo en tres puntos')
    expect(result.task?.prompt).toBe('Resúmelo en tres puntos')
    expect(env.database.getBotTeamTaskStartNotes(result.task!.id)).toContain(
      'Files attached to the team folder: attachments/flyer.png'
    )
  })

  it('asks again for each new files-only line, and the instruction carries them together', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    await post(env, '', [FLYER])
    await post(env, '', [LOGO])
    const questions = env.database
      .listBotTeamMessages(env.team.id)
      .filter((message) => message.authorBotId === env.iris.id)
      .map((message) => message.text)
    expect(questions).toEqual([
      '¿Qué quieres que haga con flyer.png?',
      '¿Qué quieres que haga con logo.png?'
    ])
    const result = await post(env, 'Compáralos')
    expect(env.database.getBotTeamTaskStartNotes(result.task!.id)).toContain(
      'Files attached to the team folder: attachments/flyer.png, attachments/logo.png'
    )
  })
})
