import { RuntimeClientError } from './runtime/types'
import type { BotTeam, BotTeamBot } from '../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../shared/rpc-contract/bot-team-room-params'
import type { BotTeamRoutine } from '../shared/rpc-contract/bot-team-routine-params'

type Named = { id: string; name: string }

/** An id wins; otherwise a name matches without regard to case, and a name two items share is refused. */
function matchOne<T extends Named>(items: readonly T[], selector: string, kind: string): T {
  const byId = items.find((item) => item.id === selector)
  if (byId !== undefined) {
    return byId
  }
  const wanted = selector.toLowerCase()
  const byName = items.filter((item) => item.name.toLowerCase() === wanted)
  if (byName.length > 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      `${kind} name "${selector}" matches ${byName.length} ${kind}s; pass its id.`
    )
  }
  const only = byName[0]
  if (only === undefined) {
    throw new RuntimeClientError('invalid_argument', `No ${kind} "${selector}" here.`)
  }
  return only
}

export function findBotTeam(teams: readonly BotTeam[], teamId: string): BotTeam {
  const team = teams.find((entry) => entry.id === teamId)
  if (team === undefined) {
    throw new RuntimeClientError('invalid_argument', `No Bot team ${teamId} on this MassOrca host.`)
  }
  return team
}

export function findNamedTeam(teams: readonly BotTeam[], selector: string): BotTeam {
  return matchOne(teams, selector, 'team')
}

export function findBot(team: BotTeam, selector: string): BotTeamBot {
  return matchOne(team.bots, selector, 'bot')
}

export function findProject(projects: readonly BotTeamProject[], selector: string): BotTeamProject {
  return matchOne(projects, selector, 'project')
}

export function findRoutine(routines: readonly BotTeamRoutine[], selector: string): BotTeamRoutine {
  return matchOne(routines, selector, 'routine')
}

/** The bot's name on its team, or its id when the team no longer lists it. */
export function botNameOf(team: BotTeam | undefined, botId: string | null): string {
  if (botId === null) {
    return 'whole team'
  }
  return team?.bots.find((bot) => bot.id === botId)?.name ?? botId
}
