import {
  getAgentResumeArgv,
  isResumableTuiAgent,
  type AgentProviderSessionMetadata,
  type ResumableTuiAgent,
  type SleepingAgentSessionRecord
} from '../../../../shared/agent-session-resume'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import type { PiRuntimeSelection } from '../../../../shared/pi-runtime-selection'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'

/** The agents with a structured adapter on this build; their chat can be revealed by session id. */
const STRUCTURED_CHAT_RETURN_AGENTS: ReadonlySet<string> = new Set([
  'claude',
  'codex',
  'pi',
  'antigravity'
])

export type StructuredChatTerminalViewBlock = 'no-worktree' | 'agent' | 'no-provider-session'

export type StructuredChatTerminalViewState =
  | { enabled: true; agent: ResumableTuiAgent; providerSession: AgentProviderSessionMetadata }
  | { enabled: false; reason: StructuredChatTerminalViewBlock }

/** Whether this chat can be shown in the terminal view, and if not, the one reason the button names. */
export function structuredChatTerminalViewState(args: {
  worktreeId: string
  agent: string
  providerSession: AgentProviderSessionMetadata | undefined
}): StructuredChatTerminalViewState {
  if (!args.worktreeId) {
    return { enabled: false, reason: 'no-worktree' }
  }
  if (!isResumableTuiAgent(args.agent)) {
    return { enabled: false, reason: 'agent' }
  }
  if (!args.providerSession || !getAgentResumeArgv(args.agent, args.providerSession)) {
    return { enabled: false, reason: 'no-provider-session' }
  }
  return { enabled: true, agent: args.agent, providerSession: args.providerSession }
}

export type ShowStructuredChatInTerminalArgs = {
  target: RuntimeClientTarget
  tabId: string
  worktreeId: string
  paneKey: string
  sessionId: string
  agent: ResumableTuiAgent
  providerSession: AgentProviderSessionMetadata
  /** Pi-only: the chat's runtime, so the terminal resumes the same command. */
  piRuntime?: PiRuntimeSelection
}

/** Resumes a sleeping session in a terminal; `onSessionLaunched` names the new tab before it returns. */
export type StructuredChatTerminalLaunchResume = (
  record: SleepingAgentSessionRecord,
  options: { onSessionLaunched: (tabId: string) => void }
) => boolean

export type ShowStructuredChatInTerminalDeps = {
  releaseProviderChild: (
    target: RuntimeClientTarget,
    sessionId: string
  ) => Promise<'closed' | 'unsupported'>
  launchResume: StructuredChatTerminalLaunchResume
  /** Lets the terminal's back-to-chat control reopen this structured chat. */
  recordTerminalLink: (tabId: string, link: StructuredChatTerminalLink) => void
  closeChatTab: (tabId: string) => void
  /** The release itself failed: the provider child may still run, so the chat stays as it was. */
  onReleaseFailed: () => void
  /** The child is released but the terminal did not start; the chat stays open and says so. */
  onLaunchFailedAfterRelease: () => void
  now?: () => number
}

/**
 * Releases the chat's provider child, then resumes the same provider session in a terminal. The
 * release is awaited first so two provider processes never hold one session at once. The chat tab
 * closes only after the terminal resume has been launched.
 */
export async function showStructuredChatInTerminal(
  args: ShowStructuredChatInTerminalArgs,
  deps: ShowStructuredChatInTerminalDeps
): Promise<boolean> {
  let released: 'closed' | 'unsupported'
  try {
    released = await deps.releaseProviderChild(args.target, args.sessionId)
  } catch {
    deps.onReleaseFailed()
    return false
  }
  if (released !== 'closed') {
    deps.onReleaseFailed()
    return false
  }
  const now = deps.now?.() ?? Date.now()
  const launchedTab: { tabId: string | null } = { tabId: null }
  const launched = deps.launchResume(
    {
      paneKey: args.paneKey,
      worktreeId: args.worktreeId,
      agent: args.agent,
      providerSession: args.providerSession,
      ...(args.piRuntime ? { piRuntime: args.piRuntime } : {}),
      prompt: '',
      state: 'done',
      capturedAt: now,
      updatedAt: now
    },
    {
      onSessionLaunched: (tabId) => {
        launchedTab.tabId = tabId
      }
    }
  )
  if (!launched) {
    deps.onLaunchFailedAfterRelease()
    return false
  }
  // Why: a terminal can return only to a chat the host can reveal, so an agent without a structured adapter keeps a plain terminal.
  if (launchedTab.tabId !== null && STRUCTURED_CHAT_RETURN_AGENTS.has(args.agent)) {
    deps.recordTerminalLink(launchedTab.tabId, {
      agent: args.agent,
      providerSessionId: args.providerSession.id,
      worktreeId: args.worktreeId,
      structuredSessionId: args.sessionId
    })
  }
  // Why: the close RPC is idempotent on the host (an unknown session returns ok), so closing the tab after release is safe.
  deps.closeChatTab(args.tabId)
  return true
}
