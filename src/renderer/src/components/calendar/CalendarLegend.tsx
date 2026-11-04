import { CalendarClock } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'

/** Each team's character and name, then Automations for ordinary Orca automations. */
export function CalendarLegend({
  teams,
  automationsLabel
}: {
  teams: readonly BotTeam[]
  automationsLabel: string
}): React.JSX.Element {
  return (
    <div
      aria-label={translate('components.calendar.teamsAria', 'Teams')}
      className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground"
    >
      {teams.map((team) => (
        <span key={team.id} className="flex items-center gap-1.5">
          <span aria-hidden className="flex">
            <BotTeamCharacterIcon character={team.character} size={20} still />
          </span>
          {team.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <CalendarClock aria-hidden className="size-5" />
        {automationsLabel}
      </span>
    </div>
  )
}
