/**
 * Mobile's `agent.launch` requests and their answers: a workspace create, and a launch into an
 * existing workspace. `worktree.create` + `startupAgent` creates the worktree agent-first, so its
 * terminal IS the agent and a chat is unreachable; `agent.launch` lets the host settle the surface.
 */

import {
  withoutReservedAgentCreateFields,
  type AgentLaunchPlacement,
  type AgentLaunchPrompt,
  type AgentLaunchResult
} from '../../../src/shared/agent-launch-intent'
import {
  AGENT_LAUNCH_PREFERRED_MODE_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_RUNTIME_CAPABILITY
} from '../../../src/shared/agent-launch-runtime-capability'
import { makePaneKey } from '../../../src/shared/stable-pane-id'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { structuredSessionRandomUuid } from '../session/structured-session-operation-id'
import type { RpcSendParams } from '../transport/rpc-params-contract'
import type { WorkspaceCreateParams } from './workspace-create-params'

/** What this host's `agent.launch` can do, in the `| false` shape `worktree.create`'s own
 *  idempotency probe already uses: `false` is an older host with no `agent.launch` at all. */
export type AgentLaunchSupport = {
  /** The host deduplicates operationId durably and refuses unknown or expired outcomes. */
  replay: boolean
  /** The host reads `preferredMode`, so a chat asked for over a terminal default is honoured. */
  preferredMode?: boolean
}

export function readAgentLaunchSupport(
  capabilities: readonly string[] | null | undefined
): AgentLaunchSupport | false {
  if (!capabilities?.includes(AGENT_LAUNCH_RUNTIME_CAPABILITY)) {
    return false
  }
  return {
    replay: capabilities.includes(AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY),
    preferredMode: capabilities.includes(AGENT_LAUNCH_PREFERRED_MODE_RUNTIME_CAPABILITY)
  }
}

export type WorktreeCreateAgentLaunch = {
  agent: TuiAgent
  /** Resolved before the first create: an older host has no `agent.launch` at all. */
  supported: AgentLaunchSupport | false | Promise<AgentLaunchSupport | false>
  /** The first turn the new session starts with; only an `agent.launch` host can deliver it. */
  prompt?: AgentLaunchPrompt
  /** Model, effort, fast and access seeded into a structured chat; an older host drops them. */
  sessionOptions?: Readonly<Record<string, string>>
  /**
   * When set, a host that refuses `agent.launch` ends the create with this message instead of
   * falling back to a plain `worktree.create`, which would start a bare agent and lose `prompt`.
   */
  refuseDowngrade?: string
}

/** `worktreeId` is tied to the shared contract so a change to it fails this reader's typecheck
 *  rather than silently passing a differently-typed field through. */
export type AgentLaunchCreateOutcome = {
  worktreeId: AgentLaunchResult['worktreeId']
  warning?: string
  /** Absent when the receipt says nothing, which callers must read as "not confirmed". */
  promptDelivered?: boolean
  /** The pane key that lands the phone on the tab the launch built, when the host named it. */
  paneKey?: string
  /** The surface the host built and its own sentence for why, from the launch receipt. */
  surface?: { mode: 'structured' | 'terminal'; detail: string }
}

export function agentLaunchCreateParams(
  agent: TuiAgent,
  create: WorkspaceCreateParams,
  operationId?: string | null,
  extras?: Pick<WorktreeCreateAgentLaunch, 'prompt' | 'sessionOptions'>
): RpcSendParams<'agent.launch'> {
  return {
    agent,
    ...(operationId ? { operationId } : {}),
    target: { kind: 'create-worktree', create: withoutReservedAgentCreateFields(create) },
    ...(extras?.prompt ? { prompt: extras.prompt } : {}),
    ...(extras?.sessionOptions ? { sessionOptions: { ...extras.sessionOptions } } : {}),
    // Every agent the phone starts is meant to be a chat; only a blank terminal skips this builder.
    preferredMode: 'chat'
  }
}

/**
 * A launch into a workspace that already exists. Always sent as `agent.launchReplay`: a host that
 * predates `operationId` would strip it and run the launch unprotected, while the separate method
 * makes such a host refuse instead.
 */
export function agentLaunchExistingParams(args: {
  agent: TuiAgent
  worktreeId: string
  operationId: string
  prompt?: AgentLaunchPrompt
  sessionOptions?: Readonly<Record<string, string>>
  launchSource?: string
  paneKey?: string
  sessionId?: string
  placement?: AgentLaunchPlacement
}): RpcSendParams<'agent.launchReplay'> {
  return {
    agent: args.agent,
    operationId: args.operationId,
    target: { kind: 'existing', worktree: `id:${args.worktreeId}` },
    ...(args.prompt ? { prompt: args.prompt } : {}),
    // An older host drops it and the chat starts on the saved defaults, as before.
    ...(args.sessionOptions ? { sessionOptions: { ...args.sessionOptions } } : {}),
    preferredMode: 'chat',
    ...(args.launchSource ? { launchSource: args.launchSource } : {}),
    ...(args.paneKey ? { paneKey: args.paneKey } : {}),
    ...(args.sessionId ? { sessionId: args.sessionId } : {}),
    // An older host drops it and the tab lands in its active group, as before.
    ...(args.placement ? { placement: args.placement } : {})
  }
}

/**
 * Reads the launch receipt, mode-blind on purpose: the host publishes and activates the tab before
 * answering, so a create-time guess at the destination would only race its snapshot.
 */
export function readAgentLaunchCreateOutcome(result: unknown): AgentLaunchCreateOutcome | null {
  if (!result || typeof result !== 'object' || !('worktreeId' in result)) {
    return null
  }
  const worktreeId = result.worktreeId
  if (typeof worktreeId !== 'string' || !worktreeId.trim()) {
    return null
  }
  // v2 guarantees that an incomplete create is reported at the top level, the same place
  // `worktree.create` puts it, so nothing here branches on which surface the host built.
  const warning = readTrimmedWarning(result)
  const promptDelivered = readPromptDelivered(result)
  const paneKey = readLandingPaneKey(result)
  const surface = readLaunchSurface(result)
  return {
    worktreeId,
    ...(warning ? { warning } : {}),
    ...(promptDelivered !== undefined ? { promptDelivered } : {}),
    ...(paneKey ? { paneKey } : {}),
    ...(surface ? { surface } : {})
  }
}

/** Said when the host built a terminal for a launch that asked for a chat; null for a chat. */
export function launchSurfaceNotice(surface: AgentLaunchCreateOutcome['surface']): string | null {
  return surface?.mode === 'terminal'
    ? `Opened as a terminal agent, not a chat. ${surface.detail}`.trim()
    : null
}

/** For a host that opens its default kind of tab: a terminal may open instead of a chat. */
export const AGENT_DEFAULT_TAB_NOTE =
  'This computer will open its default kind of tab for the agent, which may be a terminal.'

/** What the host built, so a terminal is never presented as a chat. Absent when it said nothing. */
export function readLaunchSurface(source: object): AgentLaunchCreateOutcome['surface'] {
  const receipt = 'receipt' in source ? source.receipt : undefined
  if (!receipt || typeof receipt !== 'object' || !('mode' in receipt)) {
    return undefined
  }
  const detail = 'detail' in receipt && typeof receipt.detail === 'string' ? receipt.detail : ''
  return receipt.mode === 'structured' || receipt.mode === 'terminal'
    ? { mode: receipt.mode, detail }
    : undefined
}

/**
 * The pane key of the tab a launch built: a terminal names its own, and a chat is listed under the
 * tab id the host reports. Anything the host leaves out lands the phone on the host active tab.
 */
export function readLandingPaneKey(source: object): string | undefined {
  const outcome = 'outcome' in source ? source.outcome : undefined
  if (!outcome || typeof outcome !== 'object' || !('kind' in outcome)) {
    return undefined
  }
  if (outcome.kind === 'terminal') {
    return 'paneKey' in outcome && typeof outcome.paneKey === 'string' && outcome.paneKey
      ? outcome.paneKey
      : undefined
  }
  if (outcome.kind === 'structured' && 'tabId' in outcome && typeof outcome.tabId === 'string') {
    try {
      return makePaneKey(outcome.tabId, structuredSessionRandomUuid())
    } catch {
      return undefined
    }
  }
  return undefined
}

/** Only a receipt that names how the text went can say it arrived; anything else under-claims. */
function readPromptDelivered(source: object): boolean | undefined {
  if (!('prompt' in source) || !source.prompt || typeof source.prompt !== 'object') {
    return undefined
  }
  const outcome = 'outcome' in source.prompt ? source.prompt.outcome : undefined
  return typeof outcome === 'string' ? outcome !== 'not-delivered' : undefined
}

function readTrimmedWarning(source: unknown): string {
  if (!source || typeof source !== 'object' || !('warning' in source)) {
    return ''
  }
  return typeof source.warning === 'string' ? source.warning.trim() : ''
}

/**
 * Whether the host rejected the method itself rather than the create.
 *
 * The `status.get` probe can be stale in one direction that matters: the host advertises
 * `agent.launch.v2` but has not yet recorded this client's own capability list, and then refuses
 * the call. Downgrading to `worktree.create` keeps that race from failing a create outright.
 */
export function isAgentLaunchUnsupportedRefusal(error: {
  code?: string
  message?: string
}): boolean {
  if (error.code === 'method_not_found' || error.code === 'forbidden') {
    return true
  }
  return (error.message ?? '').includes('agent_launch_unsupported')
}

// The `agent.launchReplay` twin lives in shared so the desktop classifies refusals the same way.
export { isAgentLaunchReplayUnsupportedRefusal } from '../../../src/shared/agent-launch-replay-refusal'
