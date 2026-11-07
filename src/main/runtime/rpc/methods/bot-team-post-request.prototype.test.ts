import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { botTeamPrototypeChoiceIn } from '../../../../shared/bot-team-prototype-choice'
import type { RpcContext } from '../core'

vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(async () => '{"kind":"bot","bots":["Ana"]}'),
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

describe('a room request with a prototype choice', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  async function post(prototypeChoice?: { count: number; designSystem?: 'use' | 'propose' }) {
    const database = new OrchestrationDb(':memory:')
    db = database
    const team = database.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Ana', job: 'Designer', agent: 'claude' }]
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => database,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    let notesAtStart: string | null = null
    const result = await postBotTeamRequestOnHost(
      ctx,
      {
        teamId: team.id,
        text: 'crea 3 prototipos de la landing',
        start: true,
        ...(prototypeChoice ? { prototypeChoice } : {})
      },
      async (taskId) => {
        notesAtStart = database.getBotTeamTaskStartNotes(taskId)
        return database.getBotTeamTask(taskId)
      }
    )
    return { database, result, notesAtStart }
  }

  it('saves the choice in the task start notes before the task starts', async () => {
    const { notesAtStart } = await post({ count: 3, designSystem: 'use' })
    expect(botTeamPrototypeChoiceIn(notesAtStart)).toEqual({ count: 3, designSystem: 'use' })
  })

  it('saves nothing without a choice', async () => {
    const { notesAtStart } = await post()
    expect(botTeamPrototypeChoiceIn(notesAtStart)).toBeNull()
  })
})
