import type {
  AgentSessionContinuationRequest,
  AgentSessionContinuationSource
} from '@/lib/agent-session-continuation'
import type { AgentProviderSessionMetadata } from '../../../../shared/agent-session-resume'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { PiRuntimeSelection } from '../../../../shared/pi-runtime-selection'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import {
  showStructuredChatInTerminal,
  structuredChatTerminalViewState,
  type ShowStructuredChatInTerminalDeps,
  type StructuredChatTerminalViewState
} from './structured-chat-terminal-view'

export type StructuredChatPaneActionsInput = {
  tabId: string
  /** Null when the chat's tab has no group, so split has nowhere to go. */
  groupId: string | null
  worktreeId: string
  sessionId: string
  paneKey: string
  target: RuntimeClientTarget
  agent: string
  /** Pi-only: the runtime the chat's own session names; undefined for another agent or a session with no evidence. */
  piRuntime?: PiRuntimeSelection
  providerSession: AgentProviderSessionMetadata | undefined
  workspacePath: string
  /** The conversation as plain text, for a hand-off when the provider has no transcript file. */
  capturedText: string
  lastPrompt?: string | null
  lastAssistantMessage?: string | null
}

export type StructuredChatPaneActionsDeps = {
  splitRight: (tabId: string, groupId: string) => boolean
  closeTab: (tabId: string) => void
  releaseProviderChild: ShowStructuredChatInTerminalDeps['releaseProviderChild']
  readRecordedProviderSession: ShowStructuredChatInTerminalDeps['readRecordedProviderSession']
  launchResume: ShowStructuredChatInTerminalDeps['launchResume']
  launchFresh: ShowStructuredChatInTerminalDeps['launchFresh']
  resolvePiRuntime: ShowStructuredChatInTerminalDeps['resolvePiRuntime']
  recordTerminalLink: ShowStructuredChatInTerminalDeps['recordTerminalLink']
  prepareContinuation: (args: {
    source: AgentSessionContinuationSource
    worktreeId: string
    groupId: string | null
    workspacePath: string
    initialCwd: string
  }) => AgentSessionContinuationRequest | null
  onTerminalViewReleaseFailed: (error?: unknown) => void
  onTerminalViewLaunchFailed: () => void
}

export type StructuredChatPaneActions = {
  terminalView: StructuredChatTerminalViewState
  canHandOff: boolean
  splitRight: () => void
  close: () => void
  showTerminal: () => Promise<boolean>
  handOff: () => AgentSessionContinuationRequest | null
}

/** The four header actions for a structured chat, each routed to the existing path its tab strip uses. */
export function createStructuredChatPaneActions(
  input: StructuredChatPaneActionsInput,
  deps: StructuredChatPaneActionsDeps
): StructuredChatPaneActions {
  const terminalView = structuredChatTerminalViewState({
    worktreeId: input.worktreeId,
    agent: input.agent,
    providerSession: input.providerSession
  })
  const sourceAgent = isTuiAgent(input.agent) ? input.agent : null
  return {
    terminalView,
    canHandOff: sourceAgent !== null,
    splitRight: () => {
      if (input.groupId) {
        deps.splitRight(input.tabId, input.groupId)
      }
    },
    close: () => deps.closeTab(input.tabId),
    showTerminal: async () => {
      if (!terminalView.enabled) {
        return false
      }
      return showStructuredChatInTerminal(
        {
          target: input.target,
          tabId: input.tabId,
          worktreeId: input.worktreeId,
          paneKey: input.paneKey,
          sessionId: input.sessionId,
          launch: terminalView.launch,
          ...(input.piRuntime ? { piRuntime: input.piRuntime } : {})
        },
        {
          releaseProviderChild: deps.releaseProviderChild,
          readRecordedProviderSession: deps.readRecordedProviderSession,
          launchResume: deps.launchResume,
          launchFresh: deps.launchFresh,
          resolvePiRuntime: deps.resolvePiRuntime,
          recordTerminalLink: deps.recordTerminalLink,
          closeChatTab: deps.closeTab,
          onReleaseFailed: deps.onTerminalViewReleaseFailed,
          onLaunchFailedAfterRelease: deps.onTerminalViewLaunchFailed
        }
      )
    },
    handOff: () => {
      if (!sourceAgent) {
        return null
      }
      return deps.prepareContinuation({
        source: {
          sourceAgent,
          capturedText: input.capturedText,
          sourceLabel: input.paneKey,
          sourceWorkingDirectory: input.workspacePath,
          transcriptPath: input.providerSession?.transcriptPath ?? null,
          lastPrompt: input.lastPrompt,
          lastAssistantMessage: input.lastAssistantMessage
        },
        worktreeId: input.worktreeId,
        groupId: input.groupId,
        workspacePath: input.workspacePath,
        initialCwd: input.workspacePath
      })
    }
  }
}
