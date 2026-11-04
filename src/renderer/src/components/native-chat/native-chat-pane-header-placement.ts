import type { TabGroup } from '../../../../shared/tab-types'
import { isSidePanelGroupId } from '../../store/slices/tabs/side-panel-group'

/** Where a structured chat renders its session actions: the window session bar, a split pane's top row, its own pane row, or inline. */
export type NativeChatPaneHeaderPlacement =
  | 'session-bar'
  | 'top-bar'
  | 'pane-row'
  | 'inline'
  | 'hidden'

/**
 * In a split every visible chat carries its own header: the top row over its half when it touches
 * the window's top edge, else its own pane row. The window bar never holds several panes' actions.
 */
export function nativeChatPaneHeaderPlacement({
  isVisible,
  inline,
  inSplit,
  ownsSessionBar,
  topBarMounted = false
}: {
  /** The chat's pane is on screen. */
  isVisible: boolean
  /** No session bar to render into: the floating panel, or a chat not yet placed in a workspace. */
  inline: boolean
  /** The chat's pane is one of several panes in the layout that holds it. */
  inSplit: boolean
  /** The chat is the focused session of its own workspace. */
  ownsSessionBar: boolean
  /** The chat's pane group draws a top row in the split. */
  topBarMounted?: boolean
}): NativeChatPaneHeaderPlacement {
  if (!isVisible) {
    return 'hidden'
  }
  if (inline) {
    return 'inline'
  }
  if (inSplit) {
    return topBarMounted ? 'top-bar' : 'pane-row'
  }
  return ownsSessionBar ? 'session-bar' : 'hidden'
}

/** Whether the pane group is one of several main panes in the layout that holds it. */
export function isPaneGroupInSplit(
  groupsByWorktree: Readonly<Record<string, readonly TabGroup[] | undefined>>,
  groupId: string | undefined
): boolean {
  if (!groupId || isSidePanelGroupId(groupId)) {
    return false
  }
  for (const groups of Object.values(groupsByWorktree)) {
    if (groups?.some((group) => group.id === groupId)) {
      return groups.filter((group) => !isSidePanelGroupId(group.id)).length > 1
    }
  }
  return false
}
