import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  agentLaunchRun,
  agentLaunchReplayRun,
  worktreeCreateRun
} from './mobile-workspace-create-operations'
import {
  CLIENT_WORKTREE_CREATE_MAX_ATTEMPTS,
  getClientWorktreeCreateCandidate,
  getGeneratedWorktreeCreateRetryCandidate,
  isRetryableWorktreeCreateConflict
} from '../../../src/shared/new-workspace/worktree-create-retry-policy'
import {
  agentLaunchCreateParams,
  isAgentLaunchReplayUnsupportedRefusal,
  isAgentLaunchUnsupportedRefusal,
  readAgentLaunchCreateOutcome,
  type AgentLaunchCreateOutcome,
  type WorktreeCreateAgentLaunch
} from './agent-launch-request'
import { structuredSessionOperationId } from '../session/structured-session-operation-id'
import { WORKTREE_CREATE_TIMEOUT_MS } from './workspace-create-timeout'
import type { WorkspaceCreateParams } from './workspace-create-params'
import type {
  WorktreeCreateIdempotencyProbe,
  WorktreeCreateIdempotencySupport
} from './worktree-create-idempotency-policy'
import {
  sendReplayingAmbiguousDelivery,
  type AmbiguousDeliveryReplay
} from './replay-on-ambiguous-delivery'

// Why: branches outlive worktrees and remote branches or PRs are invisible to worktree.ps, so the
// host can report a collision after a pre-flight dedupe; retry with -2, -3, ...
export type WorktreeCreateResult =
  | {
      worktreeId: string
      name: string
      warning?: string
      promptDelivered?: boolean
      paneKey?: string
      surface?: AgentLaunchCreateOutcome['surface']
    }
  | { error: string }

export type CreateWorktreeWithNameRetryArgs = {
  client: RpcClient
  baseName: string
  nameWasGenerated?: boolean
  buildParams: (name: string) => WorkspaceCreateParams
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
  /** Set when an agent was picked and the host may route the surface. Absent (or an unsupporting
   *  host) leaves `buildParams`' own `startupAgent` to create the worktree agent-first. */
  agentLaunch?: WorktreeCreateAgentLaunch
  maxAttempts?: number
  // Injected in tests; production mints a fresh idempotency key per candidate.
  mintMutationId?: () => string
  // Injected in tests; the replay-required launch keeps one identity across all deliveries.
  mintLaunchOperationId?: () => string
}

// Creates a worktree, retrying with a numeric suffix on a name collision. Callers that cannot clear
// a collision by re-suffixing (e.g. a fixed existing branch) pass maxAttempts: 1.
export async function createWorktreeWithNameRetry(
  args: CreateWorktreeWithNameRetryArgs
): Promise<WorktreeCreateResult> {
  const { client, baseName, buildParams } = args
  // Why: creating before status.get settles would silently disable safe replay
  // during the exact slow-network window this path is meant to recover from.
  const worktreeCreateIdempotency = await args.worktreeCreateIdempotency
  // Why: the route must settle before the first create, so a name-collision retry cannot land on
  // a different method than the attempt it replaces.
  let launch = await resolveAgentLaunchRoute(args.agentLaunch)
  const maxAttempts = args.maxAttempts ?? CLIENT_WORKTREE_CREATE_MAX_ATTEMPTS
  const mintMutationId = args.mintMutationId ?? defaultWorktreeCreateMutationId
  const mintLaunchOperationId = args.mintLaunchOperationId ?? structuredSessionOperationId
  let lastError: string | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateName = args.nameWasGenerated
      ? getGeneratedWorktreeCreateRetryCandidate(baseName, attempt)
      : getClientWorktreeCreateCandidate(baseName, attempt)
    const candidateParams = buildParams(candidateName)
    // Why: older hosts strip unknown fields, so only stamp and replay when the
    // host advertises idempotency. One key per candidate makes cutover retries
    // safe while a name-collision bump remains a genuinely new create.
    const params = worktreeCreateIdempotency
      ? { ...candidateParams, clientMutationId: mintMutationId() }
      : candidateParams
    // Replay-required launches own suffix selection on the host; this id names the entire create.
    const launchOperationId = launch?.replay ? mintLaunchOperationId() : null
    const sent = await sendWorktreeCreateResilient(
      client,
      launch,
      launchOperationId,
      params,
      worktreeCreateIdempotency
    )
    let response = sent.response
    if (
      !response.ok &&
      !sent.replayed &&
      launch &&
      (launchOperationId
        ? isAgentLaunchReplayUnsupportedRefusal(response.error)
        : isAgentLaunchUnsupportedRefusal(response.error))
    ) {
      // A caller whose first message cannot ride `worktree.create` must not get a bare agent.
      if (args.agentLaunch?.refuseDowngrade) {
        return { error: args.agentLaunch.refuseDowngrade }
      }
      // The probe said the host knows `agent.launch` but it refused the call — most likely this
      // client's capability list had not landed yet. Downgrade for good rather than fail a create.
      launch = null
      response = (
        await sendWorktreeCreateResilient(client, null, null, params, worktreeCreateIdempotency)
      ).response
    }
    // Ledger refusals can follow workspace creation or an expired receipt; never retry unnamed.
    // Why the raw refusal: the retry decision below is `isRetryableWorktreeCreateConflict` over the
    // host's message, and no acceptance policy carries a refusal message through without throwing.
    if (response.ok) {
      const created = readCreateResult(response, launch)
      if (created) {
        return {
          worktreeId: created.worktreeId,
          name: created.displayName?.trim() ? created.displayName : candidateName,
          ...(created.warning ? { warning: created.warning } : {}),
          ...(created.promptDelivered !== undefined
            ? { promptDelivered: created.promptDelivered }
            : {}),
          ...(created.paneKey ? { paneKey: created.paneKey } : {}),
          ...(created.surface ? { surface: created.surface } : {})
        }
      }
      lastError = 'Failed to create workspace'
      break
    }
    lastError = response.error.message
    // The replay-required host already exhausted its candidates; only legacy hosts need this loop.
    if (launch?.replay || !isRetryableWorktreeCreateConflict(lastError ?? '')) {
      break
    }
  }
  return { error: lastError ?? 'Failed to create workspace' }
}

async function resolveAgentLaunchRoute(
  launch: WorktreeCreateAgentLaunch | undefined
): Promise<ResolvedAgentLaunchRoute | null> {
  if (!launch) {
    return null
  }
  const support = await launch.supported
  return support
    ? {
        agent: launch.agent,
        replay: support.replay,
        ...(launch.prompt ? { prompt: launch.prompt } : {}),
        ...(launch.sessionOptions ? { sessionOptions: launch.sessionOptions } : {})
      }
    : null
}

type ResolvedAgentLaunchRoute = Pick<
  WorktreeCreateAgentLaunch,
  'agent' | 'prompt' | 'sessionOptions'
> & {
  replay: boolean
}

// A launch receipt carries no display name, so the candidate stands in; the session route
// re-resolves the authoritative one from the host either way. Both routes can report a warning:
// a create that seated the workspace but could not start the agent surface.
function readCreateResult(
  response: RpcResponse,
  launch: { replay: boolean } | null
): {
  worktreeId: string
  displayName?: string
  warning?: string
  promptDelivered?: boolean
  paneKey?: string
  surface?: AgentLaunchCreateOutcome['surface']
} | null {
  if (launch) {
    const operation = launch.replay ? agentLaunchReplayRun : agentLaunchRun
    return readAgentLaunchCreateOutcome(operation.interpret(response))
  }
  const created = worktreeCreateRun.interpret(response)
  // The empty-id arm stays reachable: the schema types `worktree.id` as a string without a minimum
  // length, so a host answering `''` still reports "Failed to create workspace" rather than
  // reading as an unreadable reply.
  const worktreeId = created.worktree.id
  if (!worktreeId) {
    return null
  }
  const displayName = created.worktree.displayName
  // Why: a create can succeed with the startup terminal failing (pty exhaustion); dropping
  // `warning` here is what lands the phone on an unexplained empty session.
  const warning = typeof created?.warning === 'string' ? created.warning.trim() : ''
  return {
    worktreeId,
    ...(typeof displayName === 'string' ? { displayName } : {}),
    ...(warning ? { warning } : {})
  }
}

// Re-sends a delivery-ambiguous create (the host may already have built it) with the SAME names: a
// new name is a new operation. `clientMutationId` covers `worktree.create`; the launch route needs
// `launchOperationId`, which is sent only when the host advertised the ledger.
function sendWorktreeCreateResilient(
  client: RpcClient,
  launchRoute: ResolvedAgentLaunchRoute | null,
  launchOperationId: string | null,
  params: WorkspaceCreateParams,
  worktreeCreateIdempotency: WorktreeCreateIdempotencySupport | false
): Promise<{ response: RpcResponse; replayed: boolean }> {
  // Only the selected method's receipt can authorize replay after an ambiguous delivery.
  const replay: AmbiguousDeliveryReplay | null = launchRoute
    ? launchOperationId
      ? { kind: 'durable' }
      : null
    : worktreeCreateIdempotency
      ? { kind: 'window', support: worktreeCreateIdempotency }
      : null
  return sendReplayingAmbiguousDelivery(
    client,
    () =>
      launchRoute
        ? launchOperationId
          ? agentLaunchReplayRun.request(
              client,
              {
                ...agentLaunchCreateParams(launchRoute.agent, params, null, launchRoute),
                operationId: launchOperationId
              },
              { timeoutMs: WORKTREE_CREATE_TIMEOUT_MS }
            )
          : agentLaunchRun.request(
              client,
              agentLaunchCreateParams(launchRoute.agent, params, launchOperationId, launchRoute),
              { timeoutMs: WORKTREE_CREATE_TIMEOUT_MS }
            )
        : worktreeCreateRun.request(client, params, {
            timeoutMs: WORKTREE_CREATE_TIMEOUT_MS
          }),
    replay
  )
}

function defaultWorktreeCreateMutationId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `worktree-create:${Date.now().toString(36)}:${randomPart}`
}
