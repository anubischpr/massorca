import type { KeybindingContext } from '../../../../shared/keybindings'
import { dispatchWorkspaceTabCommand } from '@/lib/workspace-tab-commands'
import { useAppStore } from '../../store'
import { sidePanelGroupId } from '../../store/slices/tabs/side-panel-group'

/**
 * Closes the side panel's shown tab. Sessions are never a target: with no panel tab this does
 * nothing, so the shortcut cannot end a conversation.
 */
export function closeSidePanelActiveTab(worktreeId: string, context: KeybindingContext): boolean {
  const state = useAppStore.getState()
  const panelId = sidePanelGroupId(worktreeId)
  const tabId = state.groupsByWorktree[worktreeId]?.find(
    (group) => group.id === panelId
  )?.activeTabId
  if (!tabId) {
    return false
  }
  return dispatchWorkspaceTabCommand({
    type: 'close',
    context,
    target: { kind: 'tab', worktreeId, tabId }
  })
}
