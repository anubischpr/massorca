import type { BotTeam, BotTeamCharacter } from '../../../../shared/rpc-contract/bot-team-params'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { formatCalendarTime } from './calendar-format'
import type { CalendarRun } from './calendar-types'

/** What a run chip, month entry or upcoming row shows for one run. */
export type CalendarRunDisplay = {
  run: CalendarRun
  time: string
  /** "bot · team", or "agent · Automations" for an automation. */
  who: string
  /** Team character, null for automations and teams this host does not know. */
  character: BotTeamCharacter | null
  past: boolean
}

export type CalendarRunDisplayContext = {
  teams: readonly BotTeam[]
  agentLabel: (agent: TuiAgent) => string
  automationsLabel: string
  now: number
  locale: string
}

export function describeCalendarRuns(
  runs: readonly CalendarRun[],
  context: CalendarRunDisplayContext
): CalendarRunDisplay[] {
  const teamsById = new Map(context.teams.map((team) => [team.id, team]))
  return runs.map((run) => {
    const team = run.teamId ? teamsById.get(run.teamId) : undefined
    const parts =
      run.source === 'automation'
        ? [run.agentId ? context.agentLabel(run.agentId) : '', context.automationsLabel]
        : [run.botName ?? '', run.teamName ?? team?.name ?? '']
    return {
      run,
      time: formatCalendarTime(run.at, context.locale),
      who: parts.filter(Boolean).join(' · '),
      character: team?.character ?? null,
      past: run.at < context.now
    }
  })
}
