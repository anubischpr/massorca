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
  refreshStructuredSessionTabs,
  revealStructuredSession
} from '@/lib/activate-ai-vault-structured-session'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
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
  /** Reopens the chat's own structured session by id; false when the host could not reveal it. */
  reopenStructuredSession: (args: { worktreeId: string; sessionId: string }) => Promise<boolean>
  newRequestId: () => AgentLaunchRequestId
}

/** The real close and adoption; the terminal pane hook passes these, tests pass their own. */
export const structuredChatTerminalReturnDeps: StructuredChatTerminalReturnDeps = {
  closeTerminalTabConfirmingExit: (tabId) =>
    closeTerminalTabConfirmingExit(useAppStore.getState(), tabId),
  resumeInStructuredChat: resumeProviderSessionInNewStructuredChat,
  reopenStructuredSession: reopenStructuredChatSession,
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
    // Why: the chat's own record survives the terminal's release, so the same session id reopens —
    // for every agent. Only a handle-backed agent that the host cannot reveal falls back to adoption.
    if (
      await deps.reopenStructuredSession({
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
  return args.link !== undefined && args.paneCount === 1
}

/**
 * Reopens a chat's own structured session by id, the way an Agent Session History row does: its tab
 * when the inventory still holds it, otherwise the host republishes the tab from its record. Opening
 * the tab starts no provider child; the chat attaches (and the adapter re-acquires) when it mounts.
 */
export async function reopenStructuredChatSession(args: {
  worktreeId: string
  sessionId: string
}): Promise<boolean> {
  if (activateStructuredAgentSessionById(args)) {
    return true
  }
  if ((await revealStructuredSession(args)) !== 'revealed') {
    return false
  }
  // The host has published the tab; the inventory catches up on refresh. The chat is open either way.
  await refreshStructuredSessionTabs(args.worktreeId).catch(() => undefined)
  activateStructuredAgentSessionById(args)
  return true
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
