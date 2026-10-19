import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { launchSleepingAgentSession } from '@/lib/sleeping-agent-session-launch'
import { useStructuredAgentSessionLaunchSelection } from '@/lib/structured-agent-session-launch-options'
import { structuredChatPiRuntime } from './structured-agent-declared-access'
import type { AgentSessionContinuationRequest } from '@/lib/agent-session-continuation'
import type { AgentJournalItemBody } from '../../../../shared/agent-session-journal-types'
import { closeStructuredAgentSession } from '../../runtime/structured-agent-session-close'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import { prepareAgentSessionContinuationFromSource } from '../terminal-pane/terminal-agent-session-continuation'
import { runNativeChatSplitTarget } from './native-chat-layout-actions'
import { structuredAgentSessionMessageText } from './structured-agent-session-message-hand-back'
import {
  createStructuredChatPaneActions,
  type StructuredChatPaneActions
} from './structured-chat-pane-actions'

type StructuredChatJournalRow = { readonly body: AgentJournalItemBody }

/** Plain text of the chat's messages, one per line, for a hand-off without a transcript file. */
export function structuredChatCapturedText(items: readonly StructuredChatJournalRow[]): string {
  return items
    .flatMap((row) =>
      row.body.kind === 'message' ? [structuredAgentSessionMessageText(row.body)] : []
    )
    .join('\n\n')
}

/** Binds a structured chat's header actions to the live store and the existing split, close, launch and hand-off paths. */
export function useStructuredChatPaneActions(args: {
  tabId: string
  groupId: string | null | undefined
  /** '' when the chat's workspace is not known yet; the terminal view then names that reason. */
  worktreeId: string
  sessionId: string
  paneKey: string
  target: RuntimeClientTarget
  agent: string
  journalItems: readonly StructuredChatJournalRow[]
  /** The chat's own notice line, so a failed terminal view says so in the chat. */
  reportNotice: (text: string) => void
}): {
  actions: StructuredChatPaneActions
  handOffRequest: AgentSessionContinuationRequest | null
  startHandOff: () => void
  closeHandOff: () => void
} {
  const {
    tabId,
    groupId,
    worktreeId,
    sessionId,
    paneKey,
    target,
    agent,
    journalItems,
    reportNotice
  } = args
  // Why: the launch's seed carries a Pi chat's runtime while the launch lives; a reopened chat falls back to the Pi command setting.
  const launchSeedOptions = useStructuredAgentSessionLaunchSelection(sessionId)?.seed
  const piCommand = useAppStore((state) => state.settings?.agentCmdOverrides?.pi)
  const piRuntime = structuredChatPiRuntime({ agent, launchSeedOptions, piCommand })
  const providerSession = useAppStore(
    (state) => state.agentStatusByPaneKey[paneKey]?.providerSession
  )
  const lastPrompt = useAppStore((state) => state.agentStatusByPaneKey[paneKey]?.prompt)
  const lastAssistantMessage = useAppStore(
    (state) => state.agentStatusByPaneKey[paneKey]?.lastAssistantMessage
  )
  const workspacePath = useAppStore((state) =>
    worktreeId ? (state.getKnownWorktreeById(worktreeId)?.path ?? '') : ''
  )
  const capturedText = useMemo(() => structuredChatCapturedText(journalItems), [journalItems])
  const actions = useMemo(
    () =>
      createStructuredChatPaneActions(
        {
          tabId,
          groupId: groupId ?? null,
          worktreeId,
          sessionId,
          paneKey,
          target,
          agent,
          piRuntime,
          providerSession,
          workspacePath,
          capturedText,
          lastPrompt,
          lastAssistantMessage
        },
        {
          splitRight: (unifiedTabId, splitGroupId) =>
            runNativeChatSplitTarget(
              { kind: 'workspace-tab', unifiedTabId, groupId: splitGroupId },
              'right'
            ),
          closeTab: (closeTabId) => {
            useAppStore.getState().closeUnifiedTab(closeTabId)
          },
          releaseProviderChild: closeStructuredAgentSession,
          launchResume: (record, options) => launchSleepingAgentSession(record, options),
          recordTerminalLink: (terminalTabId, link) =>
            useAppStore.getState().linkStructuredChatTerminalTab(terminalTabId, link),
          // Why: no structured-chat launch source exists yet; 'unknown' is honest telemetry.
          prepareContinuation: (request) =>
            prepareAgentSessionContinuationFromSource({ ...request, launchSource: 'unknown' }),
          onTerminalViewReleaseFailed: () =>
            reportNotice(
              translate(
                'components.native-chat.toggle.terminalViewReleaseFailed',
                'Could not open this chat in the terminal. The chat was left open.'
              )
            ),
          onTerminalViewLaunchFailed: () =>
            reportNotice(
              translate(
                'components.native-chat.toggle.terminalViewLaunchFailed',
                'Could not open this chat in the terminal. Its agent process was released; the chat history is kept.'
              )
            )
        }
      ),
    [
      agent,
      capturedText,
      groupId,
      lastAssistantMessage,
      lastPrompt,
      paneKey,
      piRuntime,
      providerSession,
      reportNotice,
      sessionId,
      tabId,
      target,
      workspacePath,
      worktreeId
    ]
  )
  const [handOffRequest, setHandOffRequest] = useState<AgentSessionContinuationRequest | null>(null)
  const startHandOff = useCallback(() => {
    const request = actions.handOff()
    if (request) {
      setHandOffRequest(request)
    }
  }, [actions])
  const closeHandOff = useCallback(() => setHandOffRequest(null), [])
  return { actions, handOffRequest, startHandOff, closeHandOff }
}
