import { createElement } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { BOT_TEAM_MENTION_CHIP_CLASS } from '../bot-teams/bot-team-mention-chip-class'
import { MarketplaceItemIcon } from '../marketplace/MarketplaceItemIcon'

/** A file or app picked from the @ menu: the Bot Teams chip, showing the name without the @. */
export function NativeChatMentionPill({ node }: NodeViewProps): React.JSX.Element {
  const label = String(node.attrs.label ?? '')
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={BOT_TEAM_MENTION_CHIP_CLASS}
      data-native-chat-mention={label}
    >
      {node.attrs.kind === 'app' && node.attrs.appId ? (
        <MarketplaceItemIcon id={node.attrs.appId} className="size-3" />
      ) : (
        createElement(getFileTypeIcon(label), {
          className: 'size-3 shrink-0 text-muted-foreground',
          'aria-hidden': true
        })
      )}
      {label}
    </NodeViewWrapper>
  )
}
