import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const ask = vi.hoisted(() =>
  vi.fn(async (_args: { prompt: string }): Promise<string | null> => null)
)
const askBot = vi.hoisted(() =>
  vi.fn(
    async (_args: { prompt: string; agent: { id: string; model: string | null } | null }) =>
      null as string | null
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

  async function post(reply: string | null, text = 'Count the boxes') {
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
    const result = await method?.handler({ teamId: team.id, text, start: false }, ctx)
    return { team, other, result }
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

  it('still answers in the old shape when the query fails, so the room asks', async () => {
    const { result } = await post(null)
    expect(result).toEqual({
      message: expect.objectContaining({ authorBotId: null }),
      task: null,
      startError: null
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
    it('is answered once by one bot under its own name, with no task and no session', async () => {
      askBot.mockResolvedValue('Todavía lo estamos revisando.')
      const { team, result } = await post('{"kind":"conversation"}', 'Saben si ya terminó?')
      expect(askBot).toHaveBeenCalledTimes(1)
      const messages = db?.listBotTeamMessages(team.id) ?? []
      expect(messages.map((message) => message.text)).toEqual([
        'Saben si ya terminó?',
        'Todavía lo estamos revisando.'
      ])
      expect(team.bots.map((bot) => bot.id)).toContain(messages[1].authorBotId)
      expect(result).toMatchObject({ task: null, answered: true, startError: null })
      expect(db?.listBotTeamTasks(team.id)).toEqual([])
    })

    it('lets the bot whose description fits the subject answer, on its own agent at a tier model', async () => {
      askBot.mockResolvedValue('Eso lo veo yo.')
      const { team } = await post('{"kind":"conversation","bots":["Max"]}', 'Cómo va el texto?')
      const max = team.bots.find((bot) => bot.name === 'Max')
      expect(db?.listBotTeamMessages(team.id)[1].authorBotId).toBe(max?.id)
      expect(askBot.mock.calls[0][0].agent).toMatchObject({ id: 'claude' })
      expect(askBot.mock.calls[0][0].agent?.model).toEqual(expect.any(String))
    })

    it('puts the room history and the real board in what the bot is asked', async () => {
      askBot.mockResolvedValue('Sí.')
      await post('{"kind":"conversation"}', 'Hay algo pendiente?')
      expect(askBot.mock.calls[0][0].prompt).toContain('Hay algo pendiente?')
      expect(askBot.mock.calls[0][0].prompt).toContain('No tasks yet.')
    })

    it('asks the person when no bot could answer, adding nothing to the room', async () => {
      askBot.mockResolvedValue(null)
      const { team, result } = await post('{"kind":"conversation"}', 'Hola equipo, cómo están?')
      expect(db?.listBotTeamMessages(team.id)).toHaveLength(1)
      expect(result).toEqual({
        message: expect.objectContaining({ authorBotId: null }),
        task: null,
        startError: null
      })
    })
  })
})
