import {
  splitBotTeamMentionText,
  type BotTeamMentionName
} from '../../../../shared/bot-team-mention-text'

/** Hast property of a mention span; sanitize and react-markdown both key by this property name. */
export const BOT_TEAM_MENTION_PROPERTY = 'dataBotTeamMention'
/** The attribute the chip component reads, as react-markdown passes it. */
export const BOT_TEAM_MENTION_ATTRIBUTE = 'data-bot-team-mention'
/** The same pair for a file mention, which carries its path. */
export const BOT_TEAM_MENTION_FILE_PROPERTY = 'dataBotTeamMentionFile'
export const BOT_TEAM_MENTION_FILE_ATTRIBUTE = 'data-bot-team-mention-file'

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  data?: { hName?: string; hProperties?: Record<string, string> }
}

function splitMentionsInChildren(node: MarkdownNode, names: readonly BotTeamMentionName[]): void {
  if (!node.children) {
    return
  }
  const next: MarkdownNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' || child.value === undefined) {
      splitMentionsInChildren(child, names)
      next.push(child)
      continue
    }
    for (const segment of splitBotTeamMentionText(child.value, names, { files: true })) {
      if (segment.kind === 'text') {
        next.push({ type: 'text', value: segment.value })
      } else {
        next.push({
          type: 'botTeamMention',
          children: [{ type: 'text', value: segment.value }],
          data: {
            hName: 'span',
            hProperties:
              segment.kind === 'file'
                ? { [BOT_TEAM_MENTION_FILE_PROPERTY]: segment.path }
                : { [BOT_TEAM_MENTION_PROPERTY]: segment.name }
          }
        })
      }
    }
  }
  node.children = next
}

/** Remark plugin: wraps each known `@Name` in text as a mention span; the stored text is unchanged. */
export function remarkBotTeamMentions(
  names: readonly BotTeamMentionName[]
): (tree: MarkdownNode) => void {
  return (tree) => splitMentionsInChildren(tree, names)
}
