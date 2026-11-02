import { describe, expect, it, vi } from 'vitest'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import { decideBotTeamRequest } from './bot-team-request-flow'

function bot(id: string, name: string, job: string): BotTeamBot {
  return {
    id,
    name,
    job,
    agent: 'claude',
    modelMode: 'auto',
    model: null,
    effort: null,
    skills: []
  }
}
function team(id: string, name: string, purpose: string, bots: BotTeamBot[]): BotTeam {
  return {
    id,
    name,
    purpose,
    character: 'circle',
    workspacesEnabled: false,
    accessMode: 'full-access',
    bots
  }
}

const IRIS = bot('iris', 'Iris', 'Designs flyers')
const MAX = bot('max', 'Max', 'Writes copy')
const MARKETING = team('mk', 'Marketing', 'Flyers and posts', [IRIS, MAX])
const WAREHOUSE = team('wh', 'Warehouse', 'Inventory', [bot('bea', 'Bea', 'Counts stock')])

async function decide(
  reply: string | null | Error,
  over: { text?: string; team?: BotTeam; load?: Record<string, number> } = {}
) {
  const classify = vi.fn(async (_prompt: string) => {
    if (reply instanceof Error) {
      throw reply
    }
    return reply
  })
  const decision = await decideBotTeamRequest({
    text: over.text ?? 'Make a flyer',
    team: over.team ?? MARKETING,
    otherTeams: [WAREHOUSE],
    activeTasksByBot: over.load ?? {},
    classify
  })
  return { decision, classify }
}

describe('decideBotTeamRequest', () => {
  it('gives a mentioned bot the request without asking anything', async () => {
    const { decision, classify } = await decide(null, { text: '@Max write a post' })
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'task', bot: MAX, alsoNeeds: [] })
  })

  it('sends a request that mentions another team there, without asking anything', async () => {
    const { decision, classify } = await decide(null, { text: '@Warehouse count the boxes' })
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'team', teamId: 'wh' })
  })

  it('prefers a bot of this team when a bot and a team share the mention', async () => {
    const same = team('mk', 'Marketing', '', [bot('w', 'Warehouse', 'Counts')])
    const { decision } = await decide(null, { text: '@Warehouse hi', team: same })
    expect(decision).toMatchObject({ type: 'task', bot: { id: 'w' } })
  })

  it('gives a specific task to the matching bot with the fewest active tasks', async () => {
    const { decision, classify } = await decide('{"kind":"bot","bots":["Iris","Max"]}', {
      load: { iris: 3, max: 1 }
    })
    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify.mock.calls[0][0]).toContain('Warehouse: Inventory')
    expect(decision).toEqual({ type: 'task', bot: MAX, alsoNeeds: [] })
  })

  it('gives a composite task to one bot and names the others it needs', async () => {
    const { decision } = await decide('{"kind":"composite","bots":["Iris","Max"]}')
    expect(decision).toEqual({ type: 'task', bot: IRIS, alsoNeeds: ['max'] })
  })

  it('offers a new bot when the team covers the subject but no bot does', async () => {
    expect((await decide('{"kind":"team-scope"}')).decision).toEqual({
      type: 'choice',
      choice: { kind: 'new-bot' }
    })
  })

  it('suggests another team that exists, and a new team when none fits', async () => {
    expect((await decide('{"kind":"other-team","team":"Warehouse"}')).decision).toEqual({
      type: 'choice',
      choice: { kind: 'other-team', teamId: 'wh' }
    })
    expect((await decide('{"kind":"none"}')).decision).toEqual({
      type: 'choice',
      choice: { kind: 'new-team' }
    })
  })

  it('leaves plain conversation to its own answer', async () => {
    expect((await decide('{"kind":"conversation"}')).decision).toEqual({
      type: 'conversation',
      subjectBotIds: []
    })
    expect((await decide('{"kind":"conversation","bots":["Max"]}')).decision).toEqual({
      type: 'conversation',
      subjectBotIds: ['max']
    })
  })

  it('offers a bot choice when the query fails, throws or is unreadable, so the person always sees an outcome', async () => {
    for (const reply of [null, new Error('timeout'), 'no idea']) {
      expect((await decide(reply)).decision, String(reply)).toEqual({
        type: 'choice',
        choice: { kind: 'new-bot' }
      })
    }
  })

  it('preselects the bot the query named as closest, not the first bot in team order', async () => {
    const { decision } = await decide('{"kind":"team-scope","bots":["Max"]}', {
      text: 'Plan the spring season'
    })
    expect(decision).toEqual({
      type: 'choice',
      choice: { kind: 'new-bot', suggestedBotId: 'max' }
    })
  })

  it('reads another team named with its word team, and offers a bot choice when no team matches', async () => {
    expect((await decide('{"kind":"other-team","team":"Warehouse team"}')).decision).toEqual({
      type: 'choice',
      choice: { kind: 'other-team', teamId: 'wh' }
    })
    expect((await decide('{"kind":"other-team","team":"Almacén"}')).decision).toEqual({
      type: 'choice',
      choice: { kind: 'new-bot' }
    })
  })

  describe('the QA request about front work', () => {
    const CRISTHOFER = bot(
      'cristhofer',
      'Cristhofer',
      'Se encarga del front de las aplicaciónes, web, mobile, desktop.'
    )
    const JUAN = bot('juan', 'Juan', 'backend')
    const DESARROLLO = team('dev', 'Desarrollo', 'NexusCare', [JUAN, CRISTHOFER])
    const REQUEST =
      'tengo como pendiente la tarea de analizar mejoras de front, pero no para hoy, sino para mañana, agréguenlo al Todo.'

    it('gives it to the bot whose job names its subject, though the query said no bot covers it', async () => {
      const { decision } = await decide('{"kind":"team-scope"}', {
        text: REQUEST,
        team: DESARROLLO
      })
      expect(decision).toEqual({ type: 'task', bot: CRISTHOFER, alsoNeeds: [], later: true })
    })

    it('gives it to the bot the query names, and keeps it for later', async () => {
      const { decision } = await decide('{"kind":"bot","bots":["Cristhofer"],"later":true}', {
        text: REQUEST,
        team: DESARROLLO
      })
      expect(decision).toEqual({ type: 'task', bot: CRISTHOFER, alsoNeeds: [], later: true })
    })
  })

  it('keeps the request of a one-bot team with its bot when the query cannot answer', async () => {
    const solo = team('solo', 'Solo', '', [IRIS])
    expect((await decide(null, { team: solo })).decision).toEqual({
      type: 'task',
      bot: IRIS,
      alsoNeeds: []
    })
  })

  it('asks when the team has no bot at all', async () => {
    const empty = team('e', 'Empty', '', [])
    const { decision, classify } = await decide('{"kind":"bot","bots":["Iris"]}', { team: empty })
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'ask' })
  })
})
