import { createPortal } from 'react-dom'
import type { AgentJournalItemBody } from '../../../../shared/agent-session-journal-types'
import { structuredAgentSessionPaneKey } from '../../../../shared/structured-agent-session-projection'
import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import { useAppStore } from '../../store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { useSessionBarActionsTarget } from '../../app-shell/session-bar-slot'
import { selectFocusedSessionTab } from '../../store/slices/tabs/side-panel-group'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import type { PiRuntimeSelection } from '../../../../shared/pi-runtime-selection'
import { NativeChatStructuredPaneHeader } from './NativeChatStructuredPaneHeader'
import { useStructuredChatPaneActions } from './use-structured-chat-pane-actions'
import {
  chatTransitionKeyForSession,
  useChatTransitionPending
} from './structured-chat-transition-guard'

/** A structured chat's session actions and its hand-off dialog. The actions show only while the pane is the visible session. */
export function NativeChatStructuredPaneHeaderBar({
  isVisible,
  tabId,
  groupId,
  worktreeId,
  sessionId,
  target,
  agent,
  controller,
  reportNotice
}: {
  isVisible: boolean
  tabId: string
  groupId?: string
  /** '' when the chat's workspace is not known yet. */
  worktreeId: string
  sessionId: string
  target: RuntimeClientTarget
  agent: string
  controller: {
    journalItems: readonly { readonly body: AgentJournalItemBody }[]
    /** The Pi runtime the host recorded for this chat, once its options read answered. */
    hostPiRuntime: PiRuntimeSelection | undefined
  }
  reportNotice: (text: string) => void
}): React.JSX.Element {
  const { actions, handOffRequest, startHandOff, closeHandOff } = useStructuredChatPaneActions({
    tabId,
    groupId,
    reportNotice,
    worktreeId,
    sessionId,
    paneKey: structuredAgentSessionPaneKey(tabId, sessionId),
    target,
    agent,
    journalItems: controller.journalItems,
    hostPiRuntime: controller.hostPiRuntime
  })
  const terminalPending = useChatTransitionPending(chatTransitionKeyForSession(sessionId))
  const summaryVisible = useAppStore((store) => store.settings?.nativeChatSummaryVisible !== false)
  const updateSettings = useAppStore((store) => store.updateSettings)
  const barTarget = useSessionBarActionsTarget()
  const ownsSessionBar = useAppStore(
    (store) => selectFocusedSessionTab(store, worktreeId)?.id === tabId
  )
  // Why inline: the floating panel and a not-yet-placed chat have no session bar to render into.
  const inline = !barTarget || worktreeId === '' || worktreeId === FLOATING_TERMINAL_WORKTREE_ID
  const header = (
    <NativeChatStructuredPaneHeader
      canHandOff={actions.canHandOff}
      terminalView={actions.terminalView}
      onHandOff={startHandOff}
      onShowTerminal={() => void actions.showTerminal()}
      terminalPending={terminalPending}
      onSplitRight={actions.splitRight}
      summaryVisible={summaryVisible}
      onToggleSummary={() => void updateSettings({ nativeChatSummaryVisible: !summaryVisible })}
    />
  )
  return (
    <>
      {isVisible ? (
        inline ? (
          <div className="flex h-8 shrink-0 items-center justify-end border-b border-border px-2">
            {header}
          </div>
        ) : ownsSessionBar && barTarget ? (
          createPortal(header, barTarget)
        ) : null
      ) : null}
      {handOffRequest ? (
        <AgentSessionContinuationDialog
          open
          request={handOffRequest}
          sourceChatPiRuntime={controller.hostPiRuntime}
          onOpenChange={(open) => {
            if (!open) {
              closeHandOff()
            }
          }}
        />
      ) : null}
    </>
  )
}
