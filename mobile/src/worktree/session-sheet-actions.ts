import { Copy, Pencil, X } from 'lucide-react-native'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { parsePaneKey } from '../../../src/shared/stable-pane-id'

/**
 * The long-press sheet for one session row: Rename and Close only when the row may manage its
 * terminal, then Copy Path, which every row offers.
 */
export function buildSessionSheetActions(args: {
  onCopyPath: () => void
  onRename?: () => void
  onClose?: () => void
}): ActionSheetAction[] {
  return [
    ...(args.onRename
      ? [{ label: 'Rename', icon: Pencil, closeBeforePress: true, onPress: args.onRename }]
      : []),
    { label: 'Copy Path', icon: Copy, onPress: args.onCopyPath },
    ...(args.onClose ? [{ label: 'Close', icon: X, destructive: true, onPress: args.onClose }] : [])
  ]
}

/**
 * Whether a session row may rename and close its terminal, by the desktop session menu's rule. The
 * row needs a live terminal handle, and it must not run in another worktree or share its parent's
 * tab: either way the tab is not the session's alone to name or close.
 */
export function canManageSessionTerminal(
  agent: Pick<RuntimeWorktreeAgentRow, 'paneKey' | 'parentPaneKey' | 'terminalHandle'>,
  options: { runsElsewhere: boolean }
): boolean {
  if (!agent.terminalHandle || options.runsElsewhere) {
    return false
  }
  const ownTabId = parsePaneKey(agent.paneKey)?.tabId
  const parentTabId = agent.parentPaneKey ? parsePaneKey(agent.parentPaneKey)?.tabId : undefined
  return parentTabId === undefined || parentTabId !== ownTabId
}
