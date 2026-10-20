import type { AgentJournalItemBody } from '../../../../shared/agent-session-journal-types'
import { structuredAgentSessionPaneKey } from '../../../../shared/structured-agent-session-projection'
import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import type { PiRuntimeSelection } from '../../../../shared/pi-runtime-selection'
import { NativeChatStructuredPaneHeader } from './NativeChatStructuredPaneHeader'
import { useStructuredChatPaneActions } from './use-structured-chat-pane-actions'
import {
  chatTransitionKeyForSession,
  useChatTransitionPending
} from './structured-chat-transition-guard'

/** A structured chat's header and its hand-off dialog. The header shows only while the pane is visible. */
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
  return (
    <>
      {isVisible ? (
        <NativeChatStructuredPaneHeader
          canHandOff={actions.canHandOff}
          terminalView={actions.terminalView}
          onHandOff={startHandOff}
          onShowTerminal={() => void actions.showTerminal()}
          terminalPending={terminalPending}
          onSplitRight={actions.splitRight}
          onClose={actions.close}
        />
      ) : null}
      {handOffRequest ? (
        <AgentSessionContinuationDialog
          open
          request={handOffRequest}
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
