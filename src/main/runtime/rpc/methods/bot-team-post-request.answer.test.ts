import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(async () => null),
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))
const followUp = vi.hoisted(() => vi.fn(async (_sessionId: string, _text: string) => true))
vi.mock('../../../bot-teams/bot-team-task-session-turns', () => ({
  sendBotTeamTaskFollowUp: followUp
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

describe("a room reply to a bot's open question", () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    followUp.mockClear()
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Desarrollo',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Catalina', job: 'Reviews screens', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Revisión de captura',
      prompt: 'Archivos adjuntos: alterra web.png',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'catalina-session')
    db.postBotTeamMessage({
      teamId: team.id,
      authorBotId: team.bots[0].id,
      text: '¿Qué resultado necesitas que produzca a partir de esta captura?'
    })
    db.markBotTeamTaskWaiting(task.id)
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    return { team, task, ctx }
  }

  it("reaches the waiting bot's session instead of filing a new task", async () => {
    const { team, task, ctx } = setup()
    const before = db!.listBotTeamTasks(team.id).length
    const result = await postBotTeamRequestOnHost(
      ctx,
      { teamId: team.id, text: 'Revisa la accesibilidad del buscador', start: true },
      async () => {
        throw new Error('no new task starts')
      }
    )
    expect(result.task?.id).toBe(task.id)
    expect(followUp).toHaveBeenCalledWith(
      'catalina-session',
      expect.stringContaining('Revisa la accesibilidad del buscador')
    )
    expect(db!.listBotTeamTasks(team.id)).toHaveLength(before)
  })
})
