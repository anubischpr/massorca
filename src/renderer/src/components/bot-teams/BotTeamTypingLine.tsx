import { translate } from '@/i18n/i18n'
import type { BotTeamTypingAuthor } from '../../../../shared/bot-team-typing'
import type { BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'

const DOT_DELAYS_MS = [0, 160, 320]

/** "{bot} is typing" with three dots while the host prepares the room's reply. */
export function BotTeamTypingLine({
  author,
  bots
}: {
  author: BotTeamTypingAuthor<BotTeamBot>
  bots: readonly BotTeamBot[]
}): React.JSX.Element {
  const label =
    author.kind === 'bot'
      ? translate('components.botTeams.botTyping', '{{bot}} is typing', { bot: author.bot.name })
      : author.kind === 'all'
        ? translate('components.botTeams.allTyping', 'All is typing')
        : translate('components.botTeams.teamTyping', 'Typing')
  return (
    <div role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
      {author.kind === 'bot' ? <BotAgentIcon agent={author.bot.agent} size={16} /> : null}
      {author.kind === 'all' ? (
        <span className="flex items-center gap-1">
          {bots.map((bot) => (
            <BotAgentIcon key={bot.id} agent={bot.agent} size={16} />
          ))}
        </span>
      ) : null}
      <span>{label}</span>
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className="size-1 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  )
}
