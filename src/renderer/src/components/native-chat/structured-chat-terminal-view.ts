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
import { chatTransitionKeyForSession, runChatTransition } from './structured-chat-transition-guard'

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
 * Without a provider session in the status the launch is provisional: showing the terminal reads the
 * host's record first, and starts fresh only when that holds no conversation either.
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
  /** The provider session the host's record holds, read when the status has none. Throws when the host
   *  cannot say, and the chat then stays open rather than starting fresh. */
  readRecordedProviderSession: (
    target: RuntimeClientTarget,
    sessionId: string
  ) => Promise<AgentProviderSessionMetadata | undefined>
  launchResume: StructuredChatTerminalLaunchResume
  launchFresh: StructuredChatTerminalLaunchFresh
  /** Lets the terminal's back-to-chat control reopen this structured chat. */
  recordTerminalLink: (tabId: string, link: StructuredChatTerminalLink) => void
  closeChatTab: (tabId: string) => void
  /** The release itself failed: the provider child may still run, so the chat stays as it was. The
   *  error, when there is one, carries the host's refusal reason for the toast. */
  onReleaseFailed: (error?: unknown) => void
  /** The child is released but the terminal did not start; the chat stays open and says so. */
  onLaunchFailedAfterRelease: () => void
  now?: () => number
}

/**
 * Releases the chat's provider child, then starts its terminal: the same provider session resumed,
 * or a fresh TUI of the same agent. The session is the status's, or the host record's when the status
 * has none, and the chat is released only once that is known. The release is awaited first so two
 * provider processes never hold one session at once. The chat tab closes only after the terminal has
 * been launched.
 */
export async function showStructuredChatInTerminal(
  args: ShowStructuredChatInTerminalArgs,
  deps: ShowStructuredChatInTerminalDeps
): Promise<boolean> {
  // Why: a repeat click while the switch runs would otherwise start one more terminal per click.
  return (
    (await runChatTransition([chatTransitionKeyForSession(args.sessionId)], () =>
      switchStructuredChatToTerminal(args, deps)
    )) ?? false
  )
}

/**
 * The launch the chat's host record supports. A status without a session falls back to the record's,
 * so a chat starts fresh only when it has no conversation. Null when that session cannot be resumed.
 */
async function launchFromRecordedSession(
  args: ShowStructuredChatInTerminalArgs,
  deps: ShowStructuredChatInTerminalDeps
): Promise<StructuredChatTerminalLaunch | null> {
  if (args.launch.mode === 'resume') {
    return args.launch
  }
  const recorded = await deps.readRecordedProviderSession(args.target, args.sessionId)
  if (!recorded) {
    return args.launch
  }
  const view = structuredChatTerminalViewState({
    worktreeId: args.worktreeId,
    agent: args.launch.agent,
    providerSession: recorded
  })
  return view.enabled ? view.launch : null
}

async function switchStructuredChatToTerminal(
  args: ShowStructuredChatInTerminalArgs,
  deps: ShowStructuredChatInTerminalDeps
): Promise<boolean> {
  // Why first: the host answers before anything is released, so a chat it cannot describe stays open.
  let launch: StructuredChatTerminalLaunch | null
  try {
    launch = await launchFromRecordedSession(args, deps)
  } catch (error) {
    deps.onReleaseFailed(error)
    return false
  }
  if (!launch) {
    deps.onReleaseFailed()
    return false
  }
  // Why: the host may need a beat to answer, and the chat must not be released until the terminal can start.
  const piRuntime =
    launch.agent === 'pi'
      ? await deps.resolvePiRuntime({
          worktreeId: args.worktreeId,
          ...(args.piRuntime ? { sessionRuntime: args.piRuntime } : {})
        })
      : undefined
  let released: 'closed' | 'unsupported'
  try {
    released = await deps.releaseProviderChild(args.target, args.sessionId)
  } catch (error) {
    deps.onReleaseFailed(error)
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
  // Why: a fresh terminal has no provider session yet, but its chat is still listed by id, so back-to-chat reopens it by that id alone.
  if (
    launchedTab.tabId !== null &&
    isResumableTuiAgent(launch.agent) &&
    STRUCTURED_CHAT_RETURN_AGENTS.has(launch.agent)
  ) {
    deps.recordTerminalLink(launchedTab.tabId, {
      agent: launch.agent,
      ...(launch.mode === 'resume' ? { providerSessionId: launch.providerSession.id } : {}),
      worktreeId: args.worktreeId,
      structuredSessionId: args.sessionId
    })
  }
  // Why: the close RPC is idempotent on the host (an unknown session returns ok), so closing the tab after release is safe.
  deps.closeChatTab(args.tabId)
  return true
}
