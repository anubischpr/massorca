import { translate } from '@/i18n/i18n'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../shared/bot-team-greeting'
import { isBotTeamFilesOnlyText } from '../../../../shared/bot-team-room-attachments-line'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamAllAuthor } from './BotTeamAllAuthor'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamFileChipTeamContext } from './BotTeamFileChipHover'
import type { BotTeamMentionIcon } from './BotTeamMentionChip'
import { BotTeamRoomAttachChips } from './BotTeamRoomAttachChips'
import { BotTeamRoomMessageBody } from './BotTeamRoomMessageBody'

const fromTeamTag = (from: BotTeam): string =>
  translate('components.botTeams.fromTeam', 'From {{team}}', {
    team: from.name
  })

/** One line of the room: the person's, a bot's, or a bot of another team reporting a finished request. */
export function BotTeamRoomMessage({
  message,
  team,
  otherTeams,
  mentions,
  onOpenFile,
  children
}: {
  message: BotTeamMessage
  team: BotTeam
  otherTeams: readonly BotTeam[]
  mentions: readonly BotTeamMentionIcon[]
  onOpenFile?: (path: string) => void
  /** The cards that sit right under the message. */
  children?: React.ReactNode
}): React.JSX.Element {
  const fromTeam = otherTeams.find((entry) => entry.id === message.fromTeamId)
  const author = (fromTeam ?? team).bots.find((bot) => bot.id === message.authorBotId)
  const fromAll = message.authorBotId === BOT_TEAM_ALL_AUTHOR
  return (
    <div className="flex flex-col gap-3">
      {author ? (
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <BotAgentIcon agent={author.agent} size={16} />
          {author.name}
          {fromTeam ? (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <BotTeamCharacterIcon character={fromTeam.character} size={14} />
              {fromTeamTag(fromTeam)}
            </span>
          ) : null}
        </div>
      ) : null}
      {fromAll ? <BotTeamAllAuthor bots={team.bots} /> : null}
      <div
        className={
          author || fromAll
            ? 'text-sm leading-relaxed text-foreground/80'
            : 'max-w-[80%] self-end rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed'
        }
      >
        {isBotTeamFilesOnlyText(message.text, message.attachments) ? null : (
          <BotTeamFileChipTeamContext.Provider value={team.id}>
            <BotTeamRoomMessageBody text={message.text} mentions={mentions} />
          </BotTeamFileChipTeamContext.Provider>
        )}
        {message.attachments && message.attachments.length > 0 ? (
          <BotTeamRoomAttachChips
            files={message.attachments}
            onOpen={onOpenFile}
            tag={fromTeam ? fromTeamTag(fromTeam) : undefined}
            teamId={team.id}
          />
        ) : null}
      </div>
      {children}
    </div>
  )
}
