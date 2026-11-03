import { Node } from '@tiptap/react'
import { safeReactNodeViewRenderer } from '../editor/safe-react-node-view-renderer'
import { BotTeamMentionChipView } from './BotTeamMentionChipView'

/**
 * A bot, team or file picked in the room composer: one atom whose text is the plain `@Name` the
 * room sends, so the stored message never carries the chip.
 */
export const BotTeamComposerMention = Node.create({
  name: 'botTeamMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    token: { default: '' },
    kind: { default: 'file' },
    agent: { default: null },
    character: { default: null }
  }),
  renderText: ({ node }) => String(node.attrs.token ?? ''),
  renderHTML: ({ node }) => [
    'span',
    { 'data-bot-team-mention': node.attrs.token },
    node.attrs.token
  ],
  addNodeView: () => safeReactNodeViewRenderer(BotTeamMentionChipView)
})
