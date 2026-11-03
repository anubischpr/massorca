import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import {
  BOT_TEAM_MENTION_CHIP_CLASS,
  BotTeamMentionChipFace,
  type BotTeamMentionIcon
} from './BotTeamMentionChip'

function chipIcon(attrs: ReactNodeViewProps['node']['attrs'], name: string): BotTeamMentionIcon {
  switch (attrs.kind) {
    case 'bot':
      return { name, kind: 'bot', agent: attrs.agent }
    case 'team':
      return { name, kind: 'team', character: attrs.character }
    case 'project':
      return { name, kind: 'project', logo: attrs.logo ?? null }
    default:
      return { name, kind: 'file' }
  }
}

/** A mention picked in the composer: the chip the sent message draws, held as one atom. */
export function BotTeamMentionChipView({ node }: ReactNodeViewProps): React.JSX.Element {
  const token = String(node.attrs.token ?? '')
  const name = token.slice(1)
  return (
    <NodeViewWrapper as="span" className={BOT_TEAM_MENTION_CHIP_CLASS} data-bot-team-mention={name}>
      <BotTeamMentionChipFace icon={chipIcon(node.attrs, name)}>{name}</BotTeamMentionChipFace>
    </NodeViewWrapper>
  )
}
