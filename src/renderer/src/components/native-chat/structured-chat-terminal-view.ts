import {
  getAgentResumeArgv,
  isResumableTuiAgent,
  type AgentProviderSessionMetadata,
  type ResumableTuiAgent,
  type SleepingAgentSessionRecord
} from '../../../../shared/agent-session-resume'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
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

/** What the terminal starts: the chat's provider session resumed, or a fresh TUI of its agent. */
export type StructuredChatTerminalLaunch =
  | { mode: 'resume'; agent: ResumableTuiAgent; providerSession: AgentProviderSessionMetadata }
  | { mode: 'fresh'; agent: TuiAgent }

export type StructuredChatTerminalViewState =
  | { enabled: true; launch: StructuredChatTerminalLaunch }
  | { enabled: false; reason: StructuredChatTerminalViewBlock }

/**
 * Whether this chat can be shown in the terminal view, and if not, the one reason the button names.
 * A chat that has not reported a provider session yet, before its first turn, opens a fresh TUI of
 * its agent. A chat that has one never starts fresh, since that would abandon its conversation.
 */
export function structuredChatTerminalViewState(args: {
  worktreeId: string
  agent: string
  providerSession: AgentProviderSessionMetadata | undefined
}): StructuredChatTerminalViewState {
  if (!args.worktreeId) {
    return { enabled: false, reason: 'no-worktree' }
  }
  if (!isTuiAgent(args.agent)) {
    return { enabled: false, reason: 'agent' }
  }
  if (!args.providerSession) {
    return { enabled: true, launch: { mode: 'fresh', agent: args.agent } }
  }
  if (!isResumableTuiAgent(args.agent)) {
    return { enabled: false, reason: 'agent' }
  }
  if (!getAgentResumeArgv(args.agent, args.providerSession)) {
    return { enabled: false, reason: 'no-provider-session' }
  }
  return {
    enabled: true,
    launch: { mode: 'resume', agent: args.agent, providerSession: args.providerSession }
  }
}

export type ShowStructuredChatInTerminalArgs = {
  target: RuntimeClientTarget
  tabId: string
  worktreeId: string
  paneKey: string
  sessionId: string
  launch: StructuredChatTerminalLaunch
  /** Pi-only: the runtime the chat's own session names; absent until it has evidence, when the host decides. */
  piRuntime?: PiRuntimeSelection
}

/** Resumes a sleeping session in a terminal; `onSessionLaunched` names the new tab before it returns. */
export type StructuredChatTerminalLaunchResume = (
  record: SleepingAgentSessionRecord,
  options: { onSessionLaunched: (tabId: string) => void }
) => boolean

/** Starts a fresh TUI of `agent` in the chat's worktree; `onSessionLaunched` names the new tab first. */
export type StructuredChatTerminalLaunchFresh = (
  request: { worktreeId: string; agent: TuiAgent; piRuntime?: PiRuntimeSelection },
  options: { onSessionLaunched: (tabId: string) => void }
) => boolean

export type ShowStructuredChatInTerminalDeps = {
  /** Pi-only: the runtime the terminal runs. The session's own runtime wins; without one, the host decides. */
  resolvePiRuntime: (args: {
    worktreeId: string
    sessionRuntime?: PiRuntimeSelection
  }) => Promise<PiRuntimeSelection>
  releaseProviderChild: (
    target: RuntimeClientTarget,
    sessionId: string
  ) => Promise<'closed' | 'unsupported'>
  launchResume: StructuredChatTerminalLaunchResume
  launchFresh: StructuredChatTerminalLaunchFresh
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
 * Releases the chat's provider child, then starts its terminal: the same provider session resumed,
 * or a fresh TUI of the same agent. The release is awaited first so two provider processes never
 * hold one session at once. The chat tab closes only after the terminal has been launched.
 */
export async function showStructuredChatInTerminal(
  args: ShowStructuredChatInTerminalArgs,
  deps: ShowStructuredChatInTerminalDeps
): Promise<boolean> {
  // Why first: the host may need a beat to answer, and the chat must not be released until the terminal can start.
  const piRuntime =
    args.launch.agent === 'pi'
      ? await deps.resolvePiRuntime({
          worktreeId: args.worktreeId,
          ...(args.piRuntime ? { sessionRuntime: args.piRuntime } : {})
        })
      : undefined
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
  const launchedTab: { tabId: string | null } = { tabId: null }
  const options = {
    onSessionLaunched: (tabId: string) => {
      launchedTab.tabId = tabId
    }
  }
  const { launch } = args
  let launched: boolean
  if (launch.mode === 'resume') {
    const now = deps.now?.() ?? Date.now()
    launched = deps.launchResume(
      {
        paneKey: args.paneKey,
        worktreeId: args.worktreeId,
        agent: launch.agent,
        providerSession: launch.providerSession,
        ...(piRuntime ? { piRuntime } : {}),
        prompt: '',
        state: 'done',
        capturedAt: now,
        updatedAt: now
      },
      options
    )
  } else {
    launched = deps.launchFresh(
      {
        worktreeId: args.worktreeId,
        agent: launch.agent,
        ...(piRuntime ? { piRuntime } : {})
      },
      options
    )
  }
  if (!launched) {
    deps.onLaunchFailedAfterRelease()
    return false
  }
  // Why: a terminal returns to its chat only by a provider session the host can reveal, so a fresh terminal (no session yet) records no link.
  if (
    launch.mode === 'resume' &&
    launchedTab.tabId !== null &&
    STRUCTURED_CHAT_RETURN_AGENTS.has(launch.agent)
  ) {
    deps.recordTerminalLink(launchedTab.tabId, {
      agent: launch.agent,
      providerSessionId: launch.providerSession.id,
      worktreeId: args.worktreeId,
      structuredSessionId: args.sessionId
    })
  }
  // Why: the close RPC is idempotent on the host (an unknown session returns ok), so closing the tab after release is safe.
  deps.closeChatTab(args.tabId)
  return true
}
