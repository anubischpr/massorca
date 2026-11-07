import { describe, expect, it, vi } from 'vitest'
import type { BotTeamRoomAttachment } from '../../shared/bot-team-room-attachments'
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
const EMPTY = team('em', 'Empty', '', [])
const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

async function decide(
  text: string,
  options: {
    quotedBot?: BotTeamBot | null
    attachments?: BotTeamRoomAttachment[]
    team?: BotTeam
  } = {}
) {
  const classify = vi.fn(async (_prompt: string) => null)
  const decision = await decideBotTeamRequest({
    text,
    team: options.team ?? MARKETING,
    otherTeams: [WAREHOUSE],
    activeTasksByBot: {},
    classify,
    quotedBot: options.quotedBot ?? null,
    attachments: options.attachments ?? [FLYER]
  })
  return { decision, classify }
}

describe('decideBotTeamRequest for files with no words', () => {
  it('asks a bot of the team what to do with them, without a query or a task', async () => {
    const { decision, classify } = await decide('Files attached: flyer.png')
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'files', bot: IRIS })
  })

  it('has the bot the person replied to ask', async () => {
    const { decision, classify } = await decide('Files attached: flyer.png', { quotedBot: MAX })
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'files', bot: MAX })
  })

  it('has the bot the person mentioned ask, even over the quoted bot', async () => {
    const { decision } = await decide('@Max', { quotedBot: IRIS })
    expect(decision).toEqual({ type: 'files', bot: MAX })
  })

  it('asks here when the files are sent to another team with @', async () => {
    const { decision } = await decide('@Warehouse')
    expect(decision).toEqual({ type: 'files', bot: IRIS })
  })

  it('asks nothing when the team has no bot', async () => {
    const { decision } = await decide('Files attached: flyer.png', { team: EMPTY })
    expect(decision).toEqual({ type: 'ask' })
  })

  it('keeps a request with words and files as a task for the bot it names', async () => {
    const { decision, classify } = await decide('@Iris haz el flyer del viernes')
    expect(classify).not.toHaveBeenCalled()
    expect(decision).toEqual({ type: 'task', bot: IRIS, alsoNeeds: [] })
  })
})
