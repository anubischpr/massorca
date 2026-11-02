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
    expect((await decide('{"kind":"conversation"}')).decision).toEqual({ type: 'conversation' })
  })

  it('asks the person when the query fails, throws or is unreadable', async () => {
    for (const reply of [null, new Error('timeout'), 'no idea']) {
      expect((await decide(reply)).decision, String(reply)).toEqual({ type: 'ask' })
    }
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
