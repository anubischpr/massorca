import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
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

describe('a save-only answer to the files question', () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => classify.mockReset())
  afterEach(() => {
    db?.close()
    db = undefined
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
    const runtime = {
      getOrchestrationDb: () => database,
      getClientSettings: () => ({}),
      getAccountsSnapshot: () => ({ rateLimits: {} }),
      getCommitMessageAgentEnvironmentResolvers: () => undefined
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the post path reads only the runtime members set here.
    const ctx = { runtime } as unknown as RpcContext
    return { database, team, ctx, iris: team.bots[0]! }
  }

  type Env = ReturnType<typeof setup>
  const post = (env: Env, text: string, attachments: BotTeamRoomAttachment[] = []) =>
    postBotTeamRequestOnHost(
      env.ctx,
      { teamId: env.team.id, text, start: false, attachments },
      async () => {
        throw new Error('not started')
      }
    )
  const lastLine = (env: Env) => env.database.listBotTeamMessages(env.team.id).at(-1)

  it('keeps the files waiting for it, posts a short acknowledgement, and files nothing', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    await post(env, '', [FLYER])
    const result = await post(env, 'Sólo guárdalo')
    expect(result.task).toBeNull()
    expect(result.choice).toBeUndefined()
    expect(result.answered).toBe(true)
    expect(classify).not.toHaveBeenCalled()
    expect(env.database.listBotTeamTasks(env.team.id)).toEqual([])
    expect(lastLine(env)).toMatchObject({ authorBotId: env.iris.id, text: 'Guardado: flyer.png.' })
    // The files stay on the message they came with, which is what the room's Files lists.
    const filesMessage = env.database
      .listBotTeamMessages(env.team.id)
      .find((message) => message.attachments?.length)
    expect(filesMessage?.attachments).toEqual([FLYER])
  })

  it('answers in English when the person wrote in English before', async () => {
    const env = setup('Make the flyer for next week, please')
    await post(env, '', [FLYER])
    const result = await post(env, 'just save it')
    expect(result.choice).toBeUndefined()
    expect(lastLine(env)).toMatchObject({ authorBotId: env.iris.id, text: 'Saved: flyer.png.' })
  })

  it('saves the files waiting for it and the files sent with it, when the same message carries them', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    await post(env, '', [FLYER])
    const result = await post(env, 'guárdalo', [LOGO])
    expect(result.task).toBeNull()
    expect(result.choice).toBeUndefined()
    expect(result.message.attachments).toEqual([LOGO])
    expect(classify).not.toHaveBeenCalled()
    expect(lastLine(env)).toMatchObject({
      authorBotId: env.iris.id,
      text: 'Guardados: flyer.png, logo.png.'
    })
  })

  it('saves a file sent with a save-only line even when no question came before it', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    const result = await post(env, 'guárdalo', [LOGO])
    expect(result.task).toBeNull()
    expect(result.choice).toBeUndefined()
    expect(classify).not.toHaveBeenCalled()
    expect(result.message.attachments).toEqual([LOGO])
    expect(lastLine(env)).toMatchObject({ authorBotId: env.iris.id, text: 'Guardado: logo.png.' })
  })

  it('reads a save-only line with no files as a request, as before', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    classify.mockResolvedValue('{"kind":"bot","bots":["Iris"]}')
    await post(env, 'guárdalo')
    expect(classify).toHaveBeenCalledTimes(1)
  })

  it('sends a line that names another team there, instead of keeping the files here', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    const sales = env.database.createBotTeam({
      name: 'Sales',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Max', job: 'Sells flyers', agent: 'claude' }]
    })
    await post(env, '', [FLYER])
    const result = await post(env, '@Sales guárdalo', [LOGO])
    expect(result.sentTo?.teamId).toBe(sales.id)
    expect(result.answered).toBeUndefined()
    expect(lastLine(env)?.text).not.toMatch(/^Guardad/)
  })

  it('still files a task when the answer to the files question asks for real work', async () => {
    const env = setup('Hazme el flyer para la semana que viene, por favor')
    classify.mockResolvedValue('{"kind":"bot","bots":["Iris"]}')
    await post(env, '', [FLYER])
    const result = await post(env, 'Resúmelo en tres puntos')
    expect(result.task).not.toBeNull()
    expect(result.task?.prompt).toBe('Resúmelo en tres puntos')
  })
})
