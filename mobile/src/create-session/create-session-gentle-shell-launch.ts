import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  describeUnsupportedLaunch,
  probeMobileStructuredAgentSessionSupport,
  startMobileStructuredAgentSession,
  type MobileStructuredChatStart
} from '../session/mobile-structured-agent-session-launch'
import { sendMobileStructuredAgentSessionMessage } from '../session/mobile-structured-agent-session-send'
import type { WorktreeCreateIdempotencyProbe } from '../tasks/worktree-create-idempotency-policy'
import { createWorktreeWithNameRetry } from '../tasks/worktree-create-retry'
import { isRpcDeliveryUnknown } from '../transport/rpc-delivery-ambiguity'
import type { RpcClient } from '../transport/rpc-client'
import {
  CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE,
  readCreatureName,
  readPrimaryWorkspaceId,
  type CreateSessionLaunchResult,
  type CreateSessionLaunchSetup
} from './create-session-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

export const GENTLE_SHELL_UNAVAILABLE_MESSAGE = "Gentle Shell can't start a chat on this computer."

export const GENTLE_SHELL_UNCONFIRMED_MESSAGE =
  "Couldn't confirm the Gentle Shell chat started. Check the workspace before trying again."

export type GentleShellLaunchArgs = {
  client: RpcClient
  hostId: string
  repo: MobileWorkspaceRepo
  plan: CreateSessionLaunchPlan
  setup: CreateSessionLaunchSetup
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
}

type Workspace = { worktreeId: string; name: string }

/** The unavailable message with the host's reason appended when it gave one. */
function unavailableMessage(detail: string): string {
  return detail ? `${GENTLE_SHELL_UNAVAILABLE_MESSAGE} ${detail}` : GENTLE_SHELL_UNAVAILABLE_MESSAGE
}

function joinWarnings(...parts: Array<string | null | undefined>): string | undefined {
  const joined = parts.filter((part): part is string => Boolean(part?.trim())).join(' ')
  return joined || undefined
}

function pickedAccessMode(plan: CreateSessionLaunchPlan): 'default' | 'full-access' | undefined {
  const access = plan.sessionOptions?.accessMode
  return access === 'default' || access === 'full-access' ? access : undefined
}

/** A new worktree was already created by the time a chat fails, so the message says so. */
function chatStartMessage(chat: MobileStructuredChatStart, plan: CreateSessionLaunchPlan): string {
  const created = plan.kind === 'new-worktree' ? ' The workspace was created.' : ''
  switch (chat.kind) {
    case 'unsupported':
      return unavailableMessage(describeUnsupportedLaunch(chat))
    case 'failed':
      return `${chat.message}${created}`
    case 'created':
    case 'unknown':
      return `${GENTLE_SHELL_UNCONFIRMED_MESSAGE}${created}`
  }
}

async function createNewWorkspace(
  args: GentleShellLaunchArgs
): Promise<Workspace | { error: string }> {
  const baseName = await readCreatureName(args.client, args.hostId, args.plan.repoId)
  const created = await createWorktreeWithNameRetry({
    client: args.client,
    baseName,
    nameWasGenerated: true,
    worktreeCreateIdempotency: args.worktreeCreateIdempotency,
    buildParams: (name) => ({
      repo: `id:${args.plan.repoId}`,
      name,
      setupDecision: args.setup.decision,
      displayNameKind: 'generated',
      nameWasGenerated: true,
      ...(args.plan.baseBranch ? { baseBranch: args.plan.baseBranch } : {})
    })
  })
  return 'error' in created
    ? { error: created.error }
    : { worktreeId: created.worktreeId, name: created.name }
}

/** True only when the host accepted the message, so a rejected or unknown send is reported. */
async function sendFirstMessage(
  client: RpcClient,
  sessionId: string,
  fence: number,
  text: string
): Promise<boolean> {
  const outcome = await sendMobileStructuredAgentSessionMessage({
    client,
    sessionId,
    expectedRuntimeFence: fence,
    text,
    attachments: [],
    onError: () => undefined
  })
  return outcome === 'accepted' || outcome === 'queued'
}

/**
 * Starts a Gentle Shell chat with the first message. The host's `agent.launch` cannot name a Pi
 * runtime, so this path asks the structured create for Gentle Shell, then sends the message to it.
 * Support is asked before a new worktree exists, so an unavailable runtime creates nothing. Never throws.
 */
export async function launchGentleShellSession(
  args: GentleShellLaunchArgs
): Promise<CreateSessionLaunchResult> {
  try {
    const primaryId = await readPrimaryWorkspaceId(args.client, args.hostId, args.repo)
    const verdict = await probeMobileStructuredAgentSessionSupport(args.client, primaryId, 'pi', {
      piRuntime: 'gentle-shell'
    })
    if (!verdict.supported) {
      return { ok: false, message: unavailableMessage(verdict.detail) }
    }
    const workspace =
      args.plan.kind === 'new-worktree'
        ? await createNewWorkspace(args)
        : { worktreeId: primaryId, name: args.repo.displayName }
    if ('error' in workspace) {
      return { ok: false, message: workspace.error }
    }
    const chat = await startMobileStructuredAgentSession(args.client, workspace.worktreeId, 'pi', {
      piRuntime: 'gentle-shell',
      accessMode: pickedAccessMode(args.plan)
    })
    if (chat.kind !== 'created' || chat.fence === null) {
      return { ok: false, message: chatStartMessage(chat, args.plan) }
    }
    const delivered = await sendFirstMessage(
      args.client,
      chat.sessionId,
      chat.fence,
      args.plan.prompt
    )
    const warning = joinWarnings(
      delivered ? null : CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE,
      args.setup.notice
    )
    return {
      ok: true,
      worktreeId: workspace.worktreeId,
      name: workspace.name,
      ...(warning ? { warning } : {})
    }
  } catch (error) {
    if (isRpcDeliveryUnknown(error)) {
      return { ok: false, message: GENTLE_SHELL_UNCONFIRMED_MESSAGE }
    }
    const message = error instanceof Error ? error.message.trim() : ''
    return { ok: false, message: message || 'Failed to start the Gentle Shell chat' }
  }
}
