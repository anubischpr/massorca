import { createPortal } from 'react-dom'
import { MessageSquare, MessageSquarePlus, SquareSplitVertical, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { SessionBarAction } from '../../app-shell/SessionBarAction'
import { useSessionBarActionsTarget } from '../../app-shell/session-bar-slot'
import { useAppStore } from '../../store'
import { isSessionTab, selectFocusedSessionTab } from '../../store/slices/tabs/side-panel-group'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  chatTransitionKeyForTerminalTab,
  useChatTransitionPending
} from '../native-chat/structured-chat-transition-guard'

export type TerminalSessionBar = { target: HTMLElement; ownsBar: boolean }

/** Where this terminal's actions render: the shell's session bar for a session, else null (its pane headers). */
export function useTerminalSessionBar(
  worktreeId: string,
  tabId: string
): TerminalSessionBar | null {
  const target = useSessionBarActionsTarget()
  const isSession = useAppStore((state) =>
    (state.unifiedTabsByWorktree[worktreeId] ?? []).some(
      (tab) => tab.contentType === 'terminal' && tab.entityId === tabId && isSessionTab(tab)
    )
  )
  const ownsBar = useAppStore((state) => {
    const tab = selectFocusedSessionTab(state, worktreeId)
    return tab?.contentType === 'terminal' && tab.entityId === tabId
  })
  if (!isSession || !target || worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return null
  }
  return { target, ownsBar }
}

/** The terminal-view session's bar actions: hand-off, back to chat, and split right. */
export function TerminalSessionBarActions({
  target,
  tabId,
  canToggleNativeChat,
  isChatViewMode,
  onToggleNativeChat,
  canHandOff,
  onHandOff,
  onSplitRight
}: {
  target: HTMLElement
  tabId: string
  canToggleNativeChat: boolean
  isChatViewMode: boolean
  onToggleNativeChat: () => void
  canHandOff: boolean
  onHandOff: () => void
  onSplitRight: () => void
}): React.JSX.Element {
  // Why: a return to the structured chat stops this terminal first, which takes a moment.
  const chatReturnPending = useChatTransitionPending(chatTransitionKeyForTerminalTab(tabId))
  const toggleLabel = isChatViewMode
    ? translate('components.native-chat.toggle.showTerminal', 'Show terminal')
    : translate('components.native-chat.toggle.showChat', 'Show chat view')
  return createPortal(
    <div data-terminal-session-actions="true" className="flex shrink-0 items-center gap-1">
      {canHandOff ? (
        <SessionBarAction
          label={translate(
            'components.agentSessionContinuation.handOffToAnotherAgent',
            'Hand Off to Another Agent'
          )}
          icon={<MessageSquarePlus />}
          onClick={onHandOff}
        />
      ) : null}
      {canToggleNativeChat ? (
        <SessionBarAction
          label={toggleLabel}
          icon={isChatViewMode ? <SquareTerminal /> : <MessageSquare />}
          pending={chatReturnPending}
          pressed={isChatViewMode}
          onClick={onToggleNativeChat}
        />
      ) : null}
      <SessionBarAction
        label={translate(
          'auto.components.terminal.pane.TerminalContextMenu.20e565d865',
          'Split Terminal Right'
        )}
        icon={<SquareSplitVertical />}
        onClick={onSplitRight}
      />
    </div>,
    target
  )
}
