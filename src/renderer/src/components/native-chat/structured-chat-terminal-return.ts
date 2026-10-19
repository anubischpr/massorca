import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { newAgentLaunchRequestId, type AgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import {
  resumeProviderSessionInNewStructuredChat,
  type ResumeProviderSessionInNewChatArgs
} from '@/lib/provider-session-structured-chat-resume'
import type { StructuredAgentSessionProvisionalLaunch } from '@/lib/structured-agent-session-provisional-tab'
import { StructuredAgentSessionCreateError } from '@/lib/structured-agent-session-launch-errors'
import {
  activateStructuredAgentSessionById,
  findStructuredAgentSessionTab
} from '@/lib/structured-agent-session-tab-activation'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { readAgentSessionRefusalDetails } from '../../../../shared/agent-session-refusal-details'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'
import { closeTerminalTabConfirmingExit } from '../../store/terminals/terminal-tab-confirmed-close'

export type StructuredChatTerminalReturnArgs = {
  /** The terminal tab the user is leaving for the structured chat it came from. */
  tabId: string
  link: StructuredChatTerminalLink
}

export type StructuredChatTerminalReturnDeps = {
  /** Removes the terminal tab; resolves true only when every process it held confirmed its exit. */
  closeTerminalTabConfirmingExit: (tabId: string) => Promise<boolean>
  /** Null when the chat's launch never began. */
  resumeInStructuredChat: (
    args: ResumeProviderSessionInNewChatArgs
  ) => Pick<StructuredAgentSessionProvisionalLaunch, 'sessionId'> | null
  /** Reveals the chat's own tab when it is still open; false when no such tab exists. */
  reactivateStructuredSession: (args: { worktreeId: string; sessionId: string }) => boolean
  newRequestId: () => AgentLaunchRequestId
}

/** The real close and adoption; the terminal pane hook passes these, tests pass their own. */
export const structuredChatTerminalReturnDeps: StructuredChatTerminalReturnDeps = {
  closeTerminalTabConfirmingExit: (tabId) =>
    closeTerminalTabConfirmingExit(useAppStore.getState(), tabId),
  resumeInStructuredChat: resumeProviderSessionInNewStructuredChat,
  reactivateStructuredSession: (args) => activateStructuredAgentSessionById(args),
  newRequestId: newAgentLaunchRequestId
}

/** Terminal tabs whose return is already running; a repeat click on the same tab is dropped. */
const returnsInFlight = new Set<string>()

/**
 * Goes back from a terminal to the structured chat it was opened from. The adoption starts only
 * after every process of the terminal confirmed it stopped, so one provider session is never held
 * by two live processes. Resolves true when the chat's launch started.
 */
export async function returnTerminalToStructuredChat(
  args: StructuredChatTerminalReturnArgs,
  deps: StructuredChatTerminalReturnDeps = structuredChatTerminalReturnDeps
): Promise<boolean> {
  if (returnsInFlight.has(args.tabId)) {
    return false
  }
  returnsInFlight.add(args.tabId)
  try {
    const exitConfirmed = await deps.closeTerminalTabConfirmingExit(args.tabId)
    if (!exitConfirmed) {
      toast.error(
        translate(
          'components.native-chat.toggle.terminalReturnUnconfirmed',
          'Could not confirm the terminal stopped, so this chat was not reopened. The terminal may still be running.'
        )
      )
      return false
    }
    if (
      deps.reactivateStructuredSession({
        worktreeId: args.link.worktreeId,
        sessionId: args.link.structuredSessionId
      })
    ) {
      return true
    }
    if (!isAgentSessionHandleProvider(args.link.agent)) {
      showReturnFailedToast()
      return false
    }
    const launch = deps.resumeInStructuredChat({
      agent: args.link.agent,
      worktreeId: args.link.worktreeId,
      providerSessionId: args.link.providerSessionId,
      requestId: deps.newRequestId(),
      onFailed: notifyReturnFailure
    })
    if (!launch) {
      // Why: the terminal is already closed, so a launch that never began must say so.
      showReturnFailedToast()
      return false
    }
    return true
  } catch (error) {
    notifyReturnFailure(error)
    return false
  } finally {
    returnsInFlight.delete(args.tabId)
  }
}

export type TerminalChatToggleRoute =
  | { kind: 'return-to-structured-chat'; link: StructuredChatTerminalLink }
  | { kind: 'legacy-toggle' }

/** Only a single-pane terminal returns as a whole: its return retires every pane of the tab. */
export function canReturnTerminalToStructuredChat(args: {
  link: StructuredChatTerminalLink | undefined
  paneCount: number
}): boolean {
  return args.link !== undefined && args.paneCount === 1 && canReopenStructuredChat(args.link)
}

/** A handle-backed chat is re-adopted from its provider id; any other chat needs its own tab still open to return to. */
function canReopenStructuredChat(link: StructuredChatTerminalLink): boolean {
  return (
    isAgentSessionHandleProvider(link.agent) ||
    findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, {
      workspaceId: link.worktreeId,
      sessionId: link.structuredSessionId
    }) !== null
  )
}

/** A terminal the structured chat opened returns to that chat; every other toggle keeps the legacy chat view. */
export function terminalChatToggleRoute(args: {
  link: StructuredChatTerminalLink | undefined
  chatViewActive: boolean
  paneCount: number
}): TerminalChatToggleRoute {
  if (args.link && !args.chatViewActive && canReturnTerminalToStructuredChat(args)) {
    return { kind: 'return-to-structured-chat', link: args.link }
  }
  return { kind: 'legacy-toggle' }
}

function notifyReturnFailure(error: unknown): void {
  if (isLiveTerminalAdoptionRefusal(error)) {
    toast.error(
      translate(
        'components.native-chat.toggle.terminalReturnHeldByTerminal',
        'This conversation is still running in a terminal, so the chat was not reopened.'
      )
    )
    return
  }
  showReturnFailedToast()
}

function showReturnFailedToast(): void {
  toast.error(
    translate(
      'components.native-chat.toggle.terminalReturnFailed',
      'Could not reopen this chat. Its terminal was closed and the conversation is kept.'
    )
  )
}

/** The host refused the adoption because a live terminal still reports this provider session. */
function isLiveTerminalAdoptionRefusal(error: unknown): boolean {
  return (
    error instanceof StructuredAgentSessionCreateError &&
    error.code === 'agent_session_conflict' &&
    readAgentSessionRefusalDetails('agent_session_conflict', error.refusal?.details)?.reason ===
      'ownerAlive'
  )
}
