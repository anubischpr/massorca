import { LinkActionPopover } from '@/components/link-actions/LinkActionPopover'
import type { NativeChatLinkActions } from './use-native-chat-link-actions'
import { NativeChatRecordedFileViewer } from './NativeChatRecordedFileViewer'

/** What a chat's links open onto besides other panes: the action popover, and the read-only view
 *  of a file the agent saved outside a paired host's worktree. */
export function NativeChatLinkSurfaces(
  props: Omit<NativeChatLinkActions, 'onLinkClick'> & { sessionId: string }
): React.JSX.Element {
  return (
    <>
      <LinkActionPopover request={props.linkActionRequest} onClose={props.closeLinkActions} />
      <NativeChatRecordedFileViewer sessionId={props.sessionId} />
    </>
  )
}
