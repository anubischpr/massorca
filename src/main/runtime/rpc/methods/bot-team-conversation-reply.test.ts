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

  it('answers a Gentle Shell bot through Gentle Shell itself, never another agent', async () => {
    const { team, ctx } = setup('pi')
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'Hola',
      subjectBotIds: []
    })?.done
    expect(askBot.mock.calls[0][0].agent).toMatchObject({ id: 'pi', piRuntime: 'gentle-shell' })
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

const CONTEXT_OUTPUT = [
  '### Recent Observations',
  '- [decision] **Pilot scope**: Three clinics in May',
  '- [note] **Kickoff**: Notes from the kickoff call'
].join('\n')

describe('startBotTeamConversationReply with a project, language and research', () => {
  let db: OrchestrationDb | undefined
  const originalRun = engramCli.run
  afterEach(() => {
    db?.close()
    db = undefined
    askBot.mockClear()
    engramCli.run = originalRun
  })

  function setupTeam(
    database: OrchestrationDb,
    bots: { name: string; agent: 'pi' | 'claude' | 'codex' }[],
    workspacesEnabled = true
  ) {
    const team = database.createBotTeam({
      name: 'Care',
      purpose: '',
      character: 'circle',
      workspacesEnabled,
      bots: bots.map((bot) => ({ name: bot.name, job: 'Helps', agent: bot.agent }))
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => database,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => {
          throw new Error('no meter')
        },
        getCommitMessageAgentEnvironmentResolvers: () => undefined,
        listRepos: () => [{ id: 'r1', path: 'D:\\projects\\nexuscare' }]
      }
    } as unknown as RpcContext
    return { team, ctx }
  }

  /** NexusCare: a brief, one started-or-not task of the team, and the team's and the bot's memory. */
  function fileNexusCare(database: OrchestrationDb, team: { id: string; bots: { id: string }[] }) {
    const project = database.createBotTeamProject({
      teamId: team.id,
      name: 'NexusCare',
      goal: 'Care',
      codeSource: null
    })
    database.setBotTeamProjectBrief(project.id, {
      goal: 'Care',
      brief: {
        requirements: ['Pilot in May'],
        constraints: [],
        decisions: [],
        markdown: '# NexusCare brief\nPilot with three clinics.'
      }
    })
    database.setBotTeamProjectWorkspace(project.id, { key: 'repo:r1', name: 'nexuscare' })
    const task = database.createBotTeamTask({
      teamId: team.id,
      title: 'Mapear flujos',
      prompt: '',
      ownerBotId: team.bots[0].id
    })
    database.setBotTeamTaskProject(task.id, project.id)
    database.addBotTeamMemory({
      teamId: team.id,
      botId: null,
      text: 'Weekly review on Mondays',
      source: { kind: 'person', taskTitle: null }
    })
    database.addBotTeamMemory({
      teamId: team.id,
      botId: team.bots[0].id,
      text: 'Rosa prefers short notes',
      source: { kind: 'person', taskTitle: null }
    })
    return project
  }

  it('puts the named project, its brief, tasks, memories and Engram lines into the reply', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Rosa', agent: 'claude' }])
    fileNexusCare(db, team)
    const run = vi.fn(async () => ({ code: 0, stdout: CONTEXT_OUTPUT, timedOut: false }))
    engramCli.run = run
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'En qué nos quedamos en NexusCare?',
      subjectBotIds: []
    })?.done
    const prompt = askBot.mock.calls[0][0].prompt
    expect(prompt).toContain('# NexusCare brief')
    expect(prompt).toContain('- Mapear flujos, Rosa, not started')
    expect(prompt).toContain('- Weekly review on Mondays')
    expect(prompt).toContain('- Rosa prefers short notes')
    expect(prompt).toContain('- Pilot scope (decision): Three clinics in May')
    expect(run).toHaveBeenCalledWith(['context', 'nexuscare'])
  })

  it('finds the project from a lowercase name without accents', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Rosa', agent: 'claude' }])
    fileNexusCare(db, team)
    engramCli.run = vi.fn(async () => ({ code: 0, stdout: '', timedOut: false }))
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'en que nos quedamos en nexuscare?',
      subjectBotIds: []
    })?.done
    expect(askBot.mock.calls[0][0].prompt).toContain('# NexusCare brief')
  })

  it('finds a project that another team owns and has linked to this one', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Rosa', agent: 'claude' }], false)
    const other = db.createBotTeam({
      name: 'Ops',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Max', job: 'Writes', agent: 'claude' }]
    })
    const project = db.createBotTeamProject({
      teamId: other.id,
      name: 'NexusCare',
      goal: '',
      codeSource: null
    })
    db.setBotTeamProjectBrief(project.id, {
      goal: '',
      brief: {
        requirements: [],
        constraints: [],
        decisions: [],
        markdown: '# NexusCare brief\nLinked from Ops.'
      }
    })
    db.setBotTeamProjectLinkedTeams(project.id, [team.id])
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'Qué pasa con NexusCare?',
      subjectBotIds: []
    })?.done
    expect(askBot.mock.calls[0][0].prompt).toContain('Linked from Ops.')
  })

  it('gives a research question only the project brief, with no tasks, memories or Engram lines', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Iris', agent: 'claude' }])
    fileNexusCare(db, team)
    const run = vi.fn(async () => ({ code: 0, stdout: CONTEXT_OUTPUT, timedOut: false }))
    engramCli.run = run
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'Qué es NexusCare en internet?',
      subjectBotIds: [],
      research: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.prompt).toContain('# NexusCare brief')
    expect(call.prompt).not.toContain('Mapear flujos')
    expect(call.prompt).not.toContain('Weekly review on Mondays')
    expect(call.prompt).not.toContain('Pilot scope')
    expect(run).not.toHaveBeenCalled()
  })

  it('answers a research question with the Claude bot when the team also has a Gentle Shell bot', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [
      { name: 'Estrellita', agent: 'pi' },
      { name: 'Iris', agent: 'claude' }
    ])
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'Saben qué es Jev AI?',
      subjectBotIds: [],
      research: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.agent).toMatchObject({ id: 'claude' })
    expect(call.research).toBe(true)
    expect(call.prompt).toContain('Search the web')
  })

  it('says it could not search, without a web search, when no bot in the team can search', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Estrellita', agent: 'pi' }])
    await startBotTeamConversationReply(ctx, {
      team,
      text: 'Saben qué es Jev AI?',
      subjectBotIds: [],
      research: true
    })?.done
    const call = askBot.mock.calls[0][0]
    expect(call.agent).toMatchObject({ id: 'pi' })
    expect(call.research).toBeFalsy()
    expect(call.prompt).toMatch(/cannot search the web in this turn/i)
  })

  it('posts the Spanish no-answer line for a Spanish question', async () => {
    db = new OrchestrationDb(':memory:')
    const { team, ctx } = setupTeam(db, [{ name: 'Iris', agent: 'claude' }])
    askBot.mockResolvedValueOnce(null)
    const posted = await startBotTeamConversationReply(ctx, {
      team,
      text: 'En qué nos quedamos en NexusCare?',
      subjectBotIds: []
    })?.done
    expect(posted).toMatchObject({
      authorBotId: 'all',
      text: 'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    })
  })
})
