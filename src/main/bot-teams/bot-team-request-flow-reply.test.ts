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

async function decide(text: string, quotedBot: BotTeamBot | null, reply: string | null = null) {
  const classify = vi.fn(async (_prompt: string) => reply)
  const decision = await decideBotTeamRequest({
    text,
    team: MARKETING,
    otherTeams: [WAREHOUSE],
    activeTasksByBot: {},
    classify,
    quotedBot
  })
  return { decision, classify }
}

describe('decideBotTeamRequest for a room reply', () => {
  it('gives a reply to the quoted bot without asking the query', async () => {
    const { decision, classify } = await decide('Y si el viernes cambia?', MAX)
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'task', bot: MAX, alsoNeeds: [] })
  })

  it('lets an explicit bot mention win over the quoted bot', async () => {
    const { decision } = await decide('@Iris haz el flyer del viernes', MAX)
    expect(decision).toEqual({ type: 'task', bot: IRIS, alsoNeeds: [] })
  })

  it('lets an explicit team mention win over the quoted bot', async () => {
    const { decision } = await decide('@Warehouse cuenta el stock', MAX)
    expect(decision).toEqual({ type: 'team', teamId: 'wh' })
  })

  it('keeps the default routing when no bot is quoted', async () => {
    const { decision, classify } = await decide(
      'Haz un flyer',
      null,
      '{"kind":"bot","bots":["Iris"]}'
    )
    expect(classify).toHaveBeenCalledTimes(1)
    expect(decision).toEqual({ type: 'task', bot: IRIS, alsoNeeds: [] })
  })
})
