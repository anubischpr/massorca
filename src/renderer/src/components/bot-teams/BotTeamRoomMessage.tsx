import { translate } from "@/i18n/i18n";
import { BOT_TEAM_ALL_AUTHOR } from "../../../../shared/bot-team-greeting";
import { isBotTeamFilesOnlyText } from "../../../../shared/bot-team-room-attachments-line";
import { botTeamRoomTextWithFileNames } from "../../../../shared/bot-team-room-text-paths";
import type {
  BotTeam,
  BotTeamBot,
} from "../../../../shared/rpc-contract/bot-team-params";
import type { BotTeamMessage } from "../../../../shared/rpc-contract/bot-team-room-params";
import { BotAgentIcon } from "./BotAgentIcon";
import { BotTeamAllAuthor } from "./BotTeamAllAuthor";
import { BotTeamCharacterIcon } from "./BotTeamCharacterIcon";
import { botAgentNameColor } from "./bot-team-agent-color";
import { BotTeamFileChipTeamContext } from "./BotTeamFileChipHover";
import type { BotTeamMentionIcon } from "./BotTeamMentionChip";
import { BotTeamRoomAttachChips } from "./BotTeamRoomAttachChips";
import { BotTeamRoomMessageActions } from "./BotTeamRoomMessageActions";
import { BotTeamRoomMessageBody } from "./BotTeamRoomMessageBody";

const fromTeamTag = (from: BotTeam): string =>
  translate("components.botTeams.fromTeam", "From {{team}}", {
    team: from.name,
  });

/** One line of the room: the person's, a bot's, or a bot of another team reporting a finished request. */
export function BotTeamRoomMessage({
  message,
  team,
  otherTeams,
  mentions,
  onOpenFile,
  onReply,
  children,
}: {
  message: BotTeamMessage;
  team: BotTeam;
  otherTeams: readonly BotTeam[];
  mentions: readonly BotTeamMentionIcon[];
  onOpenFile?: (path: string) => void;
  /** Puts the bot's `@Name` in the composer; the reply actions show only for a named bot. */
  onReply?: (bot: BotTeamBot) => void;
  /** The cards that sit right under the message. */
  children?: React.ReactNode;
}): React.JSX.Element {
  const fromTeam = otherTeams.find((entry) => entry.id === message.fromTeamId);
  const author = (fromTeam ?? team).bots.find(
    (bot) => bot.id === message.authorBotId,
  );
  const fromAll = message.authorBotId === BOT_TEAM_ALL_AUTHOR;
  const filesOnly = isBotTeamFilesOnlyText(message.text, message.attachments);
  const text =
    message.authorBotId === null
      ? message.text
      : botTeamRoomTextWithFileNames(message.text);
  const attachments =
    message.attachments && message.attachments.length > 0 ? (
      <BotTeamRoomAttachChips
        files={message.attachments}
        onOpen={onOpenFile}
        tag={fromTeam ? fromTeamTag(fromTeam) : undefined}
        teamId={team.id}
      />
    ) : null;
  const body = filesOnly ? null : (
    <BotTeamFileChipTeamContext.Provider value={team.id}>
      <BotTeamRoomMessageBody text={text} mentions={mentions} />
    </BotTeamFileChipTeamContext.Provider>
  );
  return (
    <div className="flex flex-col gap-3">
      {author ? (
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <BotAgentIcon agent={author.agent} size={16} />
          <span style={{ color: botAgentNameColor(author.agent) }}>
            {author.name}
          </span>
          {fromTeam ? (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <BotTeamCharacterIcon character={fromTeam.character} size={14} />
              {fromTeamTag(fromTeam)}
            </span>
          ) : null}
        </div>
      ) : null}
      {fromAll ? <BotTeamAllAuthor bots={team.bots} /> : null}
      {author || fromAll ? (
        <div className="flex flex-col gap-1.5">
          {body ? (
            <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground/80">
              {body}
            </div>
          ) : null}
          {attachments}
          <BotTeamRoomMessageActions
            copyText={filesOnly ? null : message.text}
            botName={author?.name ?? ""}
            {...(author && onReply ? { onReply: () => onReply(author) } : {})}
          />
        </div>
      ) : (
        <div className="max-w-[80%] self-end rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
          {body}
          {attachments}
        </div>
      )}
      {children}
    </div>
  );
}
