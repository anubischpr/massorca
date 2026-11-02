import { translate } from '@/i18n/i18n'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'

/** The author of the team's greeting line: every bot's icon, then "All". */
export function BotTeamAllAuthor({ bots }: { bots: BotTeam['bots'] }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium">
      <span className="flex items-center gap-1">
        {bots.map((bot) => (
          <BotAgentIcon key={bot.id} agent={bot.agent} size={16} />
        ))}
      </span>
      {translate('components.botTeams.allAuthor', 'All')}
    </div>
  )
}
