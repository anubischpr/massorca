import {
  AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_RUNTIME_CAPABILITY
} from '../../../src/shared/agent-launch-runtime-capability'
import { getRepoMainWorktreeId } from '../../../src/shared/worktree/id'
import { readRetiredNameRegistryForRepo } from '../../../src/shared/worktree/retired-name-cache'
import {
  EMPTY_RETIRED_NAME_REGISTRY,
  type RetiredNameRegistry
} from '../../../src/shared/worktree/retired-name-registry'
import { getSuggestedCreatureName } from '../components/worktree-name-suggestion'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE,
  launchAgentInExistingWorkspace
} from '../session/mobile-existing-agent-launch'
import type { AgentLaunchSupport, WorktreeCreateAgentLaunch } from '../tasks/agent-launch-request'
import type { WorktreeCreateIdempotencyProbe } from '../tasks/worktree-create-idempotency-policy'
import { createWorktreeWithNameRetry } from '../tasks/worktree-create-retry'
import type { RpcClient } from '../transport/rpc-client'
import { retiredWorktreeNamesRead } from '../worktree/worktree-catalog-operations'
import { WorktreeCatalogSnapshotClient } from '../worktree/worktree-catalog-snapshot-client'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

export const CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE =
  'The session started, but your first message was not confirmed. Check the chat before sending it again.'

export type CreateSessionLaunchResult =
  | {
      ok: true
      worktreeId: string
      name: string
      /** Why the workspace opens with something missing, as the host reported it. */
      warning?: string
    }
  | { ok: false; message: string }

/** The raw capability list the existing-workspace launch gates on, rebuilt from what was probed. */
function launchCapabilities(support: AgentLaunchSupport): string[] {
  return support.replay
    ? [AGENT_LAUNCH_RUNTIME_CAPABILITY, AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY]
    : [AGENT_LAUNCH_RUNTIME_CAPABILITY]
}

/** The host catalog rows, or none: a failed read only degrades the names and ids derived from it. */
async function readCatalogRows(client: RpcClient, hostId: string) {
  try {
    const catalog = new WorktreeCatalogSnapshotClient()
    const fetched = await catalog.fetch(client, hostId)
    return fetched.kind === 'response' ? (catalog.admit(fetched.pending) ?? []) : []
  } catch {
    return []
  }
}

export async function readPrimaryWorkspaceId(
  client: RpcClient,
  hostId: string,
  repo: MobileWorkspaceRepo
): Promise<string> {
  const rows = (await readCatalogRows(client, hostId)).filter((row) => row.repoId === repo.id)
  const primary =
    rows.find((row) => row.isMainWorktree) ?? (repo.kind === 'folder' ? rows[0] : undefined)
  // Falls back to the id the host derives for the checkout of a repo itself.
  return primary?.worktreeId ?? getRepoMainWorktreeId(repo)
}

export async function readCreatureName(
  client: RpcClient,
  hostId: string,
  repoId: string
): Promise<string> {
  // The host retries a colliding name itself, so a missing list only costs a retry.
  const existingPaths = (await readCatalogRows(client, hostId)).map((row) => row.path)
  let retired: RetiredNameRegistry = EMPTY_RETIRED_NAME_REGISTRY
  try {
    const reply = await retiredWorktreeNamesRead.request(client, { repo: `id:${repoId}` })
    const names = retiredWorktreeNamesRead.interpret(reply)
    retired = readRetiredNameRegistryForRepo(names.accepted ? names.value : undefined, repoId)
  } catch {
    // Without the retired list a spent name may be reused; the workspace is still created.
  }
  return getSuggestedCreatureName(existingPaths, undefined, retired)
}

async function launchInNewWorktree(args: {
  client: RpcClient
  hostId: string
  plan: CreateSessionLaunchPlan
  support: AgentLaunchSupport
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
}): Promise<CreateSessionLaunchResult> {
  const { client, plan } = args
  const baseName = await readCreatureName(client, args.hostId, plan.repoId)
  const agentLaunch: WorktreeCreateAgentLaunch = {
    agent: plan.agent,
    supported: args.support,
    prompt: { text: plan.prompt, delivery: 'submit' },
    ...(plan.sessionOptions ? { sessionOptions: plan.sessionOptions } : {})
  }
  const created = await createWorktreeWithNameRetry({
    client,
    baseName,
    nameWasGenerated: true,
    worktreeCreateIdempotency: args.worktreeCreateIdempotency,
    agentLaunch,
    buildParams: (name) => ({
      repo: `id:${plan.repoId}`,
      name,
      // Why: the host setup policy decides, so nothing untrusted runs from a phone tap.
      setupDecision: 'inherit',
      displayNameKind: 'generated',
      nameWasGenerated: true
    })
  })
  if ('error' in created) {
    return { ok: false, message: created.error }
  }
  // Why: only a receipt that says the text arrived may stay silent; the rest asks for a look.
  const warning =
    created.promptDelivered === true
      ? created.warning
      : (created.warning ?? CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE)
  return {
    ok: true,
    worktreeId: created.worktreeId,
    name: created.name,
    ...(warning ? { warning } : {})
  }
}

async function launchInCurrentCheckout(args: {
  client: RpcClient
  hostId: string
  repo: MobileWorkspaceRepo
  plan: CreateSessionLaunchPlan
  support: AgentLaunchSupport
}): Promise<CreateSessionLaunchResult> {
  const { client, plan, repo } = args
  const worktreeId = await readPrimaryWorkspaceId(client, args.hostId, repo)
  const launched = await launchAgentInExistingWorkspace({
    client,
    hostCapabilities: launchCapabilities(args.support),
    worktreeId,
    agent: plan.agent,
    prompt: { text: plan.prompt, delivery: 'submit' },
    ...(plan.sessionOptions ? { sessionOptions: plan.sessionOptions } : {}),
    launchSource: 'create_session'
  })
  switch (launched.kind) {
    case 'unsupported':
      return { ok: false, message: AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE }
    case 'failed':
    case 'unknown':
    case 'tab-closed':
      return { ok: false, message: launched.message }
    case 'launched': {
      const hostWarning = launched.result.warning?.trim()
      const warning =
        launched.promptDelivered === true
          ? hostWarning
          : hostWarning || CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE
      return {
        ok: true,
        worktreeId,
        name: repo.displayName,
        ...(warning ? { warning } : {})
      }
    }
  }
}

/**
 * Creates the workspace the plan names and starts its agent with the first message, through the
 * host agent.launch. An older host has no such method, so nothing is created and the caller
 * keeps the text; the old form stays the way to start there. Never throws.
 */
export async function launchCreateSession(args: {
  client: RpcClient
  hostId: string
  repo: MobileWorkspaceRepo
  plan: CreateSessionLaunchPlan
  agentLaunchSupport: Promise<AgentLaunchSupport | false>
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
}): Promise<CreateSessionLaunchResult> {
  try {
    const support = await args.agentLaunchSupport
    if (!support) {
      return { ok: false, message: AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE }
    }
    return args.plan.kind === 'new-worktree'
      ? await launchInNewWorktree({ ...args, support })
      : await launchInCurrentCheckout({ ...args, support })
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : ''
    return { ok: false, message: message || 'Failed to start the session' }
  }
}
