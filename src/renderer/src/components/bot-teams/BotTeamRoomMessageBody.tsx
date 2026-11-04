import { useMemo } from 'react'
import { NativeChatMarkdown } from '../native-chat/NativeChatMarkdown'
import { createBotTeamMentionExtension, type BotTeamMentionIcon } from './BotTeamMentionChip'

/** A room message as Markdown, with each known @Name drawn as a chip; the stored text is unchanged. */
export function BotTeamRoomMessageBody({
  text,
  mentions
}: {
  text: string
  mentions: readonly BotTeamMentionIcon[]
}): React.JSX.Element {
  const extension = useMemo(() => createBotTeamMentionExtension(mentions), [mentions])
  return <NativeChatMarkdown content={text} extension={extension} />
}
