import type { ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import type { CommentMarkdownExtension } from '@/components/sidebar/CommentMarkdown'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import {
  BOT_TEAM_MENTION_ATTRIBUTE,
  BOT_TEAM_MENTION_PROPERTY,
  remarkBotTeamMentions
} from './bot-team-mention-markdown'

/** A bot or team the room can mention, with the icon its chip shows. */
export type BotTeamMentionIcon =
  | { name: string; kind: 'bot'; agent: BotTeamBot['agent'] }
  | { name: string; kind: 'team'; character: BotTeam['character'] }

type SpanProps = ComponentPropsWithoutRef<'span'> & ExtraProps

function mentionIconsByName(
  mentions: readonly BotTeamMentionIcon[]
): Map<string, BotTeamMentionIcon> {
  const icons = new Map<string, BotTeamMentionIcon>()
  for (const mention of mentions) {
    const key = mention.name.toLowerCase()
    // Why: a bot and a team may share a name; the bot's chip wins, as the @ menu lists bots first.
    if (!icons.has(key) || mention.kind === 'bot') {
      icons.set(key, mention)
    }
  }
  return icons
}

/** The chip's look, shared by the sent message and the composer's picked mention. */
export const BOT_TEAM_MENTION_CHIP_CLASS =
  'mx-px inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 align-baseline text-[0.92em] font-medium'

/** The icon a chip shows before its name; a file or unknown name shows none. */
export function BotTeamMentionChipFace({
  icon,
  children
}: {
  icon: BotTeamMentionIcon | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      {icon?.kind === 'bot' ? <BotAgentIcon agent={icon.agent} size={12} /> : null}
      {icon?.kind === 'team' ? <BotTeamCharacterIcon character={icon.character} size={12} /> : null}
      {children}
    </>
  )
}

function createMentionSpan(icons: ReadonlyMap<string, BotTeamMentionIcon>) {
  return function BotTeamMentionSpan({
    node: _node,
    children,
    ...props
  }: SpanProps): React.JSX.Element {
    const typed =
      BOT_TEAM_MENTION_ATTRIBUTE in props ? props[BOT_TEAM_MENTION_ATTRIBUTE] : undefined
    const icon = typeof typed === 'string' ? icons.get(typed.toLowerCase()) : undefined
    if (!icon) {
      return <span {...props}>{children}</span>
    }
    return (
      <span {...props} className={BOT_TEAM_MENTION_CHIP_CLASS}>
        {/* The chip shows the name alone; the message text keeps its "@Name". */}
        <BotTeamMentionChipFace icon={icon}>{icon.name}</BotTeamMentionChipFace>
      </span>
    )
  }
}

/** The markdown additions that render `@Name` as a chip: built once per mention list, then kept. */
export function createBotTeamMentionExtension(
  mentions: readonly BotTeamMentionIcon[]
): CommentMarkdownExtension {
  return {
    remarkPlugins: [[remarkBotTeamMentions, mentions.map(({ name, kind }) => ({ name, kind }))]],
    sanitizeAttributes: { span: [BOT_TEAM_MENTION_PROPERTY] },
    components: { span: createMentionSpan(mentionIconsByName(mentions)) }
  }
}
