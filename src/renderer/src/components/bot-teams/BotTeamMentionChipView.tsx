import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import {
  BOT_TEAM_MENTION_CHIP_CLASS,
  BotTeamMentionChipFace,
  type BotTeamMentionIcon
} from './BotTeamMentionChip'

/** A mention picked in the composer: the chip the sent message draws, held as one atom. */
export function BotTeamMentionChipView({ node }: ReactNodeViewProps): React.JSX.Element {
  const token = String(node.attrs.token ?? '')
  const name = token.slice(1)
  const icon: BotTeamMentionIcon | null =
    node.attrs.kind === 'bot'
      ? { name, kind: 'bot', agent: node.attrs.agent }
      : node.attrs.kind === 'team'
        ? { name, kind: 'team', character: node.attrs.character }
        : null
  return (
    <NodeViewWrapper as="span" className={BOT_TEAM_MENTION_CHIP_CLASS} data-bot-team-mention={name}>
      <BotTeamMentionChipFace icon={icon}>{name}</BotTeamMentionChipFace>
    </NodeViewWrapper>
  )
}
