import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'
import { engramCli } from './bot-team-engram-methods'

const askBot = vi.hoisted(() =>
  vi.fn(
    async (_args: {
      agent: { id: string } | null
      prompt: string
      research?: boolean
      codeRead?: { cwd: string }
    }): Promise<string | null> => 'Respuesta'
  )
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: vi.fn(),
  askBotAgentForBotTeamReply: askBot
}))

import { startBotTeamConversationReply } from './bot-team-conversation-reply'

const QUESTION = '¿Cómo funciona el login de NexusCare?'

describe('startBotTeamConversationReply with a code question', () => {
  let db: OrchestrationDb | undefined
  const originalRun = engramCli.run
  afterEach(() => {
    db?.close()
    db = undefined
    askBot.mockClear()
    engramCli.run = originalRun
  })

  function setup(options: {
    agents: ('claude' | 'pi' | 'opencode')[]
    linked?: boolean
    remote?: boolean
  }) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Care',
      purpose: '',
      character: 'circle',
      workspacesEnabled: true,
      bots: options.agents.map((agent, index) => ({ name: `Bot${index}`, job: 'Helps', agent }))
    })
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'NexusCare',
      goal: '',
      codeSource: null
    })
    if (options.linked !== false) {
      db.setBotTeamProjectWorkspace(project.id, { key: 'repo:r1', name: 'nexuscare' })
    }
    engramCli.run = vi.fn(async () => ({ code: 0, stdout: '', timedOut: false }))
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => {
          throw new Error('no meter')
        },
        getCommitMessageAgentEnvironmentResolvers: () => undefined,
        listRepos: () => [
          {
            id: 'r1',
            kind: 'git',
            path: '/work/nexus',
            displayName: 'nexuscare',
            connectionId: options.remote ? 'ssh-1' : null
          }
        ],
        listManagedWorktrees: async () => ({
          worktrees: [
            { id: 'r1::/work/nexus', repoId: 'r1', path: '/work/nexus' },
            { id: 'r1::/work/fix', repoId: 'r1', path: '/work/fix' }
          ]
        }),
        listProjectGroups: () => [],
        listFolderWorkspaces: () => []
      }
    } as unknown as RpcContext
    return { team, ctx }
  }

  it('reads the linked project main checkout, read-only, with the three sources in order', async () => {
    const { team, ctx } = setup({ agents: ['claude'] })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [],
      code: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toEqual({ cwd: '/work/nexus' })
    const { prompt } = call
    expect(prompt.indexOf('1. The project code')).toBeLessThan(prompt.indexOf('2. Engram'))
    expect(prompt.indexOf('2. Engram')).toBeLessThan(prompt.indexOf('3. OpenMetadata'))
    expect(prompt).toContain('"openmetadata"')
    expect(prompt).toMatch(/sources list/)
    expect(prompt).not.toContain('did not read the code')
  })

  it('gives a code question to a bot that reads code, never to one that cannot', async () => {
    const { team, ctx } = setup({ agents: ['opencode', 'pi'] })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [team.bots[0].id],
      code: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.agent).toMatchObject({ id: 'pi', piRuntime: 'gentle-shell' })
    expect(call.codeRead).toEqual({ cwd: '/work/nexus' })
  })

  it('answers from the context and says it did not read the code when the project is not linked', async () => {
    const { team, ctx } = setup({ agents: ['claude'], linked: false })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [],
      code: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toBeUndefined()
    expect(call.prompt).toContain('you did not read the code')
  })

  it('does the same when the checkout is on a remote host', async () => {
    const { team, ctx } = setup({ agents: ['claude'], remote: true })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [],
      code: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toBeUndefined()
    expect(call.prompt).toContain('you did not read the code')
  })

  it('does the same when no bot of the team has a code read mode', async () => {
    const { team, ctx } = setup({ agents: ['opencode'] })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [],
      code: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toBeUndefined()
    expect(call.prompt).toContain('you did not read the code')
  })

  it('keeps a question that is not marked as a code question exactly as before', async () => {
    const { team, ctx } = setup({ agents: ['claude'] })
    await startBotTeamConversationReply(ctx, { team, text: QUESTION, subjectBotIds: [] })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toBeUndefined()
    expect(call.prompt).not.toContain('did not read the code')
  })

  it('lets a code question also search the web', async () => {
    const { team, ctx } = setup({ agents: ['claude'] })
    await startBotTeamConversationReply(ctx, {
      team,
      text: QUESTION,
      subjectBotIds: [],
      code: true,
      research: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.codeRead).toEqual({ cwd: '/work/nexus' })
    expect(call.research).toBe(true)
    expect(call.prompt).toContain('search the web')
  })
})
