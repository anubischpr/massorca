import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { translate } from '@/i18n/i18n'

/** The orange question mark the Workspaces sidebar paints for a session that needs the person. */
export function BotTeamWaitingMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      role="img"
      data-bot-team-waiting
      aria-label={translate('components.botTeams.waitingForYou', 'Waiting for you')}
      className="inline-flex shrink-0"
    >
      <AgentQuestionIcon className={className ?? 'size-3.5'} />
    </span>
  )
}
