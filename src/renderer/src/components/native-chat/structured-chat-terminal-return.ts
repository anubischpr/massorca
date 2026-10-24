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
import {
  activateStructuredAgentSessionById,
  structuredAgentSessionTabListed
} from '@/lib/structured-agent-session-tab-activation'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { readAgentSessionRefusalDetails } from '../../../../shared/agent-session-refusal-details'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'
import { closeTerminalTabConfirmingExit } from '../../store/terminals/terminal-tab-confirmed-close'
import {
  chatTransitionKeyForSession,
  chatTransitionKeyForTerminalTab,
  runChatTransition
} from './structured-chat-transition-guard'

export type StructuredChatTerminalReturnArgs = {
  /** The terminal tab the user is leaving for the structured chat it came from. */
  tabId: string
  link: StructuredChatTerminalLink
}

/** The structured chat a terminal returns to, named by its session id. */
export type StructuredChatRef = { worktreeId: string; sessionId: string }

/** `ready` means the chat is listed and can be shown; the other three say why it cannot be. */
export type StructuredChatRevealOutcome = 'ready' | 'gone' | 'host-cannot-open' | 'unreachable'

export type StructuredChatTerminalReturnDeps = {
  /** Removes the terminal tab; resolves true only when every process it held confirmed its exit. */
  closeTerminalTabConfirmingExit: (tabId: string) => Promise<boolean>
  /** Lists the chat's own record without showing it, so no provider child starts. */
  revealStructuredChat: (chat: StructuredChatRef) => Promise<StructuredChatRevealOutcome>
  /** Shows a chat the inventory lists; false when it does not. */
  activateStructuredChat: (chat: StructuredChatRef) => boolean
  /** Null when the chat's launch never began. */
  resumeInStructuredChat: (
    args: ResumeProviderSessionInNewChatArgs
  ) => Pick<StructuredAgentSessionProvisionalLaunch, 'sessionId'> | null
  newRequestId: () => AgentLaunchRequestId
}

/** The real close, reveal and activation; the terminal pane hook passes these, tests pass their own. */
export const structuredChatTerminalReturnDeps: StructuredChatTerminalReturnDeps = {
  closeTerminalTabConfirmingExit: (tabId) =>
    closeTerminalTabConfirmingExit(useAppStore.getState(), tabId),
  revealStructuredChat: revealStructuredChatTab,
  activateStructuredChat: (chat) => activateStructuredAgentSessionById(chat),
  resumeInStructuredChat: resumeProviderSessionInNewStructuredChat,
  newRequestId: newAgentLaunchRequestId
}

/**
 * Goes back from a terminal to the structured chat it was opened from. The chat is revealed first,
 * so a chat that cannot be shown leaves the terminal running. The terminal is stopped next, and the
 * chat is shown only after every process confirmed its exit, since showing it re-acquires the
 * provider session. Resolves true when the chat's return started.
 */
export async function returnTerminalToStructuredChat(
  args: StructuredChatTerminalReturnArgs,
  deps: StructuredChatTerminalReturnDeps = structuredChatTerminalReturnDeps
): Promise<boolean> {
  // Why: held under the chat's key too, so a chat-to-terminal switch and this return never overlap.
  const outcome = await runChatTransition(
    [
      chatTransitionKeyForSession(args.link.structuredSessionId),
      chatTransitionKeyForTerminalTab(args.tabId)
    ],
    () => returnToChat(args, deps)
  )
  return outcome ?? false
}

async function returnToChat(
  args: StructuredChatTerminalReturnArgs,
  deps: StructuredChatTerminalReturnDeps
): Promise<boolean> {
  try {
    const chat: StructuredChatRef = {
      worktreeId: args.link.worktreeId,
      sessionId: args.link.structuredSessionId
    }
    const reveal = await deps.revealStructuredChat(chat)
    // Why: only a handle-backed agent can adopt its provider session as a new chat; any other chat
    // that cannot be listed leaves the terminal running.
    if (
      reveal !== 'ready' &&
      (!isAgentSessionHandleProvider(args.link.agent) || !args.link.providerSessionId)
    ) {
      showRevealFailedToast(reveal)
      return false
    }
    const { agent } = args.link
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
    if (reveal === 'ready') {
      if (deps.activateStructuredChat(chat)) {
        return true
      }
      toast.error(
        translate(
          'components.native-chat.toggle.terminalReturnNotShown',
          'The terminal was closed, but this chat could not be shown. Its conversation is kept.'
        )
      )
      return false
    }
    // Why: a handle-backed chat the host cannot list is adopted as a new chat, only after the exit.
    const { providerSessionId } = args.link
    if (!isAgentSessionHandleProvider(agent) || !providerSessionId) {
      showReturnFailedToast()
      return false
    }
    const launch = deps.resumeInStructuredChat({
      agent,
      worktreeId: args.link.worktreeId,
      providerSessionId,
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
 * Lists a chat's own record in the inventory so it can be shown. Opening the tab starts no provider
 * child; the chat attaches (and the adapter re-acquires) only when it mounts.
 */
export async function revealStructuredChatTab(
  chat: StructuredChatRef
): Promise<StructuredChatRevealOutcome> {
  if (structuredAgentSessionTabListed(chat)) {
    return 'ready'
  }
  const outcome = await revealStructuredSession(chat)
  if (outcome !== 'revealed') {
    return outcome
  }
  try {
    // Why: a paired host's tab reaches the inventory only through this refresh, so it is applied
    // before activation looks for it.
    await refreshStructuredSessionTabs(chat.worktreeId)
  } catch {
    return 'unreachable'
  }
  return structuredAgentSessionTabListed(chat) ? 'ready' : 'unreachable'
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

function showRevealFailedToast(outcome: Exclude<StructuredChatRevealOutcome, 'ready'>): void {
  if (outcome === 'gone') {
    toast.error(
      translate(
        'components.native-chat.toggle.terminalReturnChatGone',
        'This chat is no longer on this host, so it cannot be reopened here. The terminal was kept.'
      )
    )
    return
  }
  if (outcome === 'host-cannot-open') {
    toast.error(
      translate(
        'components.native-chat.toggle.terminalReturnChatHostCannotOpen',
        "This chat can't be reopened until MassOrca is updated. The terminal was kept."
      )
    )
    return
  }
  toast.error(
    translate(
      'components.native-chat.toggle.terminalReturnChatUnreachable',
      'Could not reach the host to reopen this chat. The terminal was kept; try again in a moment.'
    )
  )
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
