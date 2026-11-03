import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const ask = vi.hoisted(() =>
  vi.fn(async (_args: { prompt: string }): Promise<string | null> => null)
)
const askBot = vi.hoisted(() =>
  vi.fn(
    async (_args: {
      prompt: string
      agent: { id: string; model: string | null } | null
      research?: boolean
    }) => null as string | null
  )
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: ask,
  askBotAgentForBotTeamReply: askBot
}))

import { BOT_TEAM_ROOM_METHODS } from './bot-team-room'

describe('botTeams.postMessage routing', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    ask.mockReset()
    askBot.mockReset()
  })

  async function post(
    reply: string | null,
    text = 'Count the boxes',
    options: {
      start?: boolean
      projects?: string[]
      askProject?: boolean
      clientRequestId?: string
    } = {}
  ) {
    db = new OrchestrationDb(':memory:')
    ask.mockResolvedValue(reply)
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: 'Flyers',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Iris', job: 'Designs flyers', agent: 'claude' },
        { name: 'Max', job: 'Writes copy', agent: 'claude' }
      ]
    })
    for (const name of options.projects ?? []) {
      db.createBotTeamProject({ teamId: team.id, name, goal: '', codeSource: null })
    }
    const other = db.createBotTeam({
      name: 'Warehouse',
      purpose: 'Inventory',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: 'Counts stock', agent: 'claude' }]
    })
    const method = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.postMessage')
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    const result = await method?.handler(
      {
        teamId: team.id,
        text,
        start: options.start ?? false,
        askProject: options.askProject ?? false,
        ...(options.clientRequestId ? { clientRequestId: options.clientRequestId } : {})
      },
      ctx
    )
    return { team, other, result }
  }

  /** The bot's reply runs after the post returns: wait for the room to hold `count` messages. */
  async function roomHolds(teamId: string, count: number) {
    await vi.waitFor(() => expect(db?.listBotTeamMessages(teamId)).toHaveLength(count))
    return db?.listBotTeamMessages(teamId) ?? []
  }

  function context(): RpcContext {
    return {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
  }

  it('asks the one query about the bots and the other teams', async () => {
    await post('{"kind":"bot","bots":["Iris"]}')
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask.mock.calls[0][0].prompt).toContain('Warehouse: Inventory')
  })

  it('files a task for the bot that covers a specific request', async () => {
    const { team, result } = await post('{"kind":"bot","bots":["Iris"]}')
    const iris = team.bots.find((bot) => bot.name === 'Iris')
    expect(result).toMatchObject({ task: { ownerBotId: iris?.id }, startError: null })
    expect(db?.listBotTeamTasks(team.id)).toHaveLength(1)
  })

  it('files a composite task for the least busy bot it needs and names the others', async () => {
    const { team, result } = await post('{"kind":"composite","bots":["Max","Iris"]}')
    const max = team.bots.find((bot) => bot.name === 'Max')
    const iris = team.bots.find((bot) => bot.name === 'Iris')
    // Both are idle, so team order breaks the tie.
    expect(result).toMatchObject({ task: { ownerBotId: iris?.id }, composite: [max?.id] })
    // The owner reads who covers the other parts when the task starts, even if it starts later.
    const [task] = db?.listBotTeamTasks(team.id) ?? []
    expect(db?.getBotTeamTaskStartNotes(task.id)).toContain('Max (Writes copy)')
  })

  it('offers a new bot, a suggested team or a new team, and files nothing', async () => {
    const newBot = await post('{"kind":"team-scope"}')
    expect(newBot.result).toMatchObject({ task: null, choice: { kind: 'new-bot' } })
    expect(db?.listBotTeamTasks(newBot.team.id)).toEqual([])
    db?.close()
    const suggested = await post('{"kind":"other-team","team":"Warehouse"}')
    expect(suggested.result).toMatchObject({
      task: null,
      choice: { kind: 'other-team', teamId: suggested.other.id }
    })
    db?.close()
    const none = await post('{"kind":"none"}')
    expect(none.result).toMatchObject({ task: null, choice: { kind: 'new-team' } })
    expect(db?.listBotTeamMessages(none.team.id)).toHaveLength(1)
  })

  it('offers the bots to choose from when the query fails, so the person always sees an outcome', async () => {
    const { result } = await post(null)
    expect(result).toEqual({
      message: expect.objectContaining({ authorBotId: null }),
      task: null,
      startError: null,
      choice: { kind: 'new-bot' }
    })
  })

  it('offers the team when the query names another team the parser cannot match, not nothing', async () => {
    const { result } = await post(
      '{"kind":"other-team","team":"Mercadotecnia"}',
      'Haz la presentación'
    )
    expect(result).toMatchObject({ task: null, choice: { kind: 'new-bot' } })
  })

  describe('later requests, confirmations and projects', () => {
    it('files a later request in Todo for the bot that covers it: one card, not started', async () => {
      const { team, result } = await post(
        '{"kind":"bot","bots":["Iris"],"later":true}',
        'Design a flyer para mañana, agrégalo al Todo',
        { start: true }
      )
      expect(result).toMatchObject({ task: { sessionId: null }, startError: null })
      expect(db?.listBotTeamTasks(team.id)).toHaveLength(1)
    })

    it('has the owning bot confirm a later request under its own name, with the day', async () => {
      const { team } = await post(
        '{"kind":"bot","bots":["Iris"],"later":true}',
        'tengo pendiente diseñar un volante, pero para mañana, agréguenlo al Todo',
        { start: true }
      )
      const iris = team.bots.find((bot) => bot.name === 'Iris')
      expect(db?.listBotTeamMessages(team.id).at(-1)).toMatchObject({
        authorBotId: iris?.id,
        text: 'Added to Todo for tomorrow.'
      })
    })

    it('has the owning bot confirm a request saved to Todo without a day', async () => {
      const { team } = await post('{"kind":"bot","bots":["Max"]}', 'Write the post', {
        start: false
      })
      const max = team.bots.find((bot) => bot.name === 'Max')
      expect(db?.listBotTeamMessages(team.id).at(-1)).toMatchObject({
        authorBotId: max?.id,
        text: 'Added to Todo.'
      })
    })

    it('files a request into the project it names, and says so', async () => {
      const { team, result } = await post('{"kind":"bot","bots":["Iris"]}', 'Revisa NexusCare', {
        projects: ['NexusCare'],
        askProject: true
      })
      const project = db?.listBotTeamProjects(team.id)[0]
      expect(result).toMatchObject({ task: { projectId: project?.id } })
      expect(db?.listBotTeamMessages(team.id).at(-1)?.text).toBe('Added to Todo in NexusCare.')
    })

    it('asks which project a request is for when the team has projects and the request names none', async () => {
      const { team, result } = await post('{"kind":"bot","bots":["Iris"]}', 'Count the boxes', {
        projects: ['NexusCare'],
        askProject: true
      })
      const iris = team.bots.find((bot) => bot.name === 'Iris')
      expect(result).toMatchObject({ task: null, choice: { kind: 'project', botId: iris?.id } })
      expect(db?.listBotTeamTasks(team.id)).toEqual([])
    })

    it('files without asking when the client cannot show the question, as before projects', async () => {
      const { team, result } = await post('{"kind":"bot","bots":["Iris"]}', 'Count the boxes', {
        projects: ['NexusCare']
      })
      expect(result).toMatchObject({ task: { projectId: null } })
      expect(db?.listBotTeamTasks(team.id)).toHaveLength(1)
    })

    it('files the answer to the project question with the project picked, or with none', async () => {
      db = new OrchestrationDb(':memory:')
      const team = db.createBotTeam({
        name: 'Marketing',
        purpose: 'Flyers',
        character: 'circle',
        workspacesEnabled: false,
        bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
      })
      const iris = team.bots[0]
      const nexus = db.createBotTeamProject({
        teamId: team.id,
        name: 'NexusCare',
        goal: '',
        codeSource: null
      })
      const assign = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.assignRequest')
      const filed = await assign?.handler(
        {
          teamId: team.id,
          text: 'Count the boxes',
          botId: iris.id,
          start: false,
          askProject: true,
          projectId: nexus.id
        },
        context()
      )
      expect(filed).toMatchObject({ task: { ownerBotId: iris.id, projectId: nexus.id } })
      const none = await assign?.handler(
        {
          teamId: team.id,
          text: 'Count the boxes again',
          botId: iris.id,
          start: false,
          askProject: true,
          projectId: null
        },
        context()
      )
      expect(none).toMatchObject({ task: { projectId: null } })
    })
  })

  it('sends a request that mentions another team to that team, with no query', async () => {
    const { team, other, result } = await post(null, '@Warehouse   count the boxes')
    expect(ask).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      task: { teamId: other.id, ownerBotId: other.bots[0].id, prompt: 'count the boxes' },
      sentTo: { teamId: other.id, teamName: 'Warehouse' },
      startError: null
    })
    expect(db?.listBotTeamTasks(team.id)).toEqual([])
    expect(db?.listBotTeamMessages(team.id)).toHaveLength(1)
  })

  it('does not query for a mention', async () => {
    const { team, result } = await post(null, '@Max write a post')
    expect(ask).not.toHaveBeenCalled()
    expect(result).toMatchObject({ task: { ownerBotId: team.bots[1].id } })
  })

  describe('plain conversation', () => {
    it('returns at once naming the replying bot, then one bot answers under its own name with no task', async () => {
      askBot.mockResolvedValue('Todavía lo estamos revisando.')
      const { team, result } = await post('{"kind":"conversation"}', 'Saben si ya terminó?')
      expect(result).toMatchObject({ task: null, startError: null })
      expect(result).not.toHaveProperty('answered')
      expect(team.bots.map((bot) => bot.id)).toContain(
        (result as { replying: { botId: string } }).replying.botId
      )
      const messages = await roomHolds(team.id, 2)
      expect(askBot).toHaveBeenCalledTimes(1)
      expect(messages.map((message) => message.text)).toEqual([
        'Saben si ya terminó?',
        'Todavía lo estamos revisando.'
      ])
      expect(messages[1].authorBotId).toBe(
        (result as { replying: { botId: string } }).replying.botId
      )
      expect(db?.listBotTeamTasks(team.id)).toEqual([])
    })

    it('lets the bot whose description fits the subject answer, on its own agent at a tier model', async () => {
      askBot.mockResolvedValue('Eso lo veo yo.')
      const { team } = await post('{"kind":"conversation","bots":["Max"]}', 'Cómo va el texto?')
      const max = team.bots.find((bot) => bot.name === 'Max')
      const messages = await roomHolds(team.id, 2)
      expect(messages[1].authorBotId).toBe(max?.id)
      expect(askBot.mock.calls[0][0].agent).toMatchObject({ id: 'claude' })
      expect(askBot.mock.calls[0][0].agent?.model).toEqual(expect.any(String))
    })

    it('puts the room history and the real board in what the bot is asked', async () => {
      askBot.mockResolvedValue('Sí.')
      const { team } = await post('{"kind":"conversation"}', 'Hay algo pendiente?')
      await roomHolds(team.id, 2)
      expect(askBot.mock.calls[0][0].prompt).toContain('Hay algo pendiente?')
      expect(askBot.mock.calls[0][0].prompt).toContain('No tasks yet.')
      expect(askBot.mock.calls[0][0].research).toBeFalsy()
    })

    it('asks a question that needs outside knowledge with web search and no room history', async () => {
      askBot.mockResolvedValue('Resumen. Fuentes: https://example.com')
      const { team } = await post(
        '{"kind":"conversation","research":true}',
        'Cómo podría utilizar Jev AI para mejorar un sistema de RAG?'
      )
      await roomHolds(team.id, 2)
      expect(askBot.mock.calls[0][0].research).toBe(true)
      expect(askBot.mock.calls[0][0].prompt).toContain('Jev AI')
      expect(askBot.mock.calls[0][0].prompt).not.toContain('Room history')
    })

    it('posts one line from the team when no bot could answer, instead of a choice card', async () => {
      askBot.mockResolvedValue(null)
      const { team, result } = await post('{"kind":"conversation"}', 'Hola equipo, cómo están?')
      expect(result).toEqual({
        message: expect.objectContaining({ authorBotId: null }),
        task: null,
        startError: null,
        replying: { botId: expect.any(String) }
      })
      const messages = await roomHolds(team.id, 2)
      expect(messages[1]).toMatchObject({
        authorBotId: 'all',
        text: expect.stringContaining('@')
      })
    })

    it('lists the bot as replying in the room until its line is posted', async () => {
      let release: (text: string) => void = () => {}
      askBot.mockImplementation(() => new Promise((resolve) => (release = resolve)))
      const { team, result } = await post('{"kind":"conversation"}', 'Saben si ya terminó?')
      const room = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.listRoom')
      const listed = () =>
        room?.handler({ teamId: team.id }, context()) as { replying?: { botId: string }[] }
      expect(listed().replying).toEqual([
        {
          botId: (result as { replying: { botId: string } }).replying.botId,
          since: expect.any(Number)
        }
      ])
      release('Listo')
      await roomHolds(team.id, 2)
      await vi.waitFor(() => expect(listed().replying).toEqual([]))
    })

    it('leaves a room with nobody replying without the field being needed by old clients', async () => {
      askBot.mockResolvedValue('Hola')
      const { team } = await post('{"kind":"conversation"}', 'Hola equipo, cómo están?')
      await roomHolds(team.id, 2)
      const room = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.listRoom')
      expect(room?.handler({ teamId: team.id }, context())).toMatchObject({
        tasks: [],
        replying: []
      })
    })
  })

  describe('a resent send', () => {
    it('answers the second post of the same client request id with the first result, posting once', async () => {
      askBot.mockResolvedValue('Hola')
      const { team, result } = await post('{"kind":"conversation"}', 'Saben si ya terminó?', {
        clientRequestId: 'send-1'
      })
      const method = BOT_TEAM_ROOM_METHODS.find((entry) => entry.name === 'botTeams.postMessage')
      const again = await method?.handler(
        { teamId: team.id, text: 'Saben si ya terminó?', start: false, clientRequestId: 'send-1' },
        context()
      )
      expect(again).toBe(result)
      await roomHolds(team.id, 2)
      expect(askBot).toHaveBeenCalledTimes(1)
      expect(ask).toHaveBeenCalledTimes(1)
    })
  })
})
