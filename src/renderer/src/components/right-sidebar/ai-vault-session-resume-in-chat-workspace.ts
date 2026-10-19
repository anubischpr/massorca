import { resolveHostCapabilities, workspaceKindForWorktreeId } from '@/lib/agent-launch-route-input'
import {
  resolveAgentSessionLaunchRoute,
  structuredAgentSessionLaunchFeasible,
  type AgentSessionStructuredFeasibilityRequest
} from '@/lib/agent-session-launch-plan'
import { resolveStructuredAgentSessionOwner } from '@/runtime/structured-agent-session-owner'
import { useAppStore } from '@/store'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import { normalizeExecutionHostId } from '../../../../shared/execution-host'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { STRUCTURED_AGENT_SESSION_RESUME_HISTORY_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import { resolveAiVaultTargetWorkspacePath } from './ai-vault-session-launch-target'
import {
  resolveAiVaultSessionResumeInChatEligibility,
  type AiVaultResumeInChatEligibility
} from './ai-vault-session-resume-in-chat'
import {
  resolveAiVaultHistorySessionResumeState,
  type AiVaultSessionResumeState,
  type AiVaultSessionResumeTargetState
} from './ai-vault-session-resume'

/** Whether the host that recorded the conversation, and would run its chat, can adopt it. */
function aiVaultStructuredRouteAvailable(
  session: AiVaultSession,
  targetWorkspaceId: string | null,
  settings: AgentSessionStructuredFeasibilityRequest['settings']
): boolean {
  const state = useAppStore.getState()
  // The conversation lives on the host that recorded it, so only a chat on that same host can
  // resume it, the rule the terminal resume follows; that host also answers for the capability.
  const targetOwner = targetWorkspaceId
    ? resolveStructuredAgentSessionOwner(state, targetWorkspaceId)
    : null
  return (
    isAgentSessionHandleProvider(session.agent) &&
    targetWorkspaceId !== null &&
    targetOwner !== null &&
    targetOwner === normalizeExecutionHostId(session.executionHostId) &&
    structuredAgentSessionLaunchFeasible(state, {
      agent: session.agent,
      workspace: {
        kind: workspaceKindForWorktreeId(targetWorkspaceId),
        worktreeId: targetWorkspaceId
      },
      settings
    }) &&
    resolveHostCapabilities(state, targetOwner)?.includes(
      STRUCTURED_AGENT_SESSION_RESUME_HISTORY_RUNTIME_CAPABILITY
    ) === true
  )
}

/** The surface a row's primary Resume opens: the chat when the host can adopt the conversation and
 *  the Chat UI switch is on (the rule new launches follow), else the terminal as before. */
export function resolveAiVaultPrimaryResumeSurface(args: {
  session: AiVaultSession
  targetWorkspaceId: string | null
  targetState: AiVaultSessionResumeTargetState
  settings: AgentSessionStructuredFeasibilityRequest['settings']
}): { surface: 'chat'; workspaceId: string } | { surface: 'terminal' } {
  const { session, targetWorkspaceId } = args
  const eligibility = resolveAiVaultSessionResumeInChatEligibility({
    session,
    targetWorkspaceId,
    targetWorkspacePath: targetWorkspaceId
      ? resolveAiVaultTargetWorkspacePath(args.targetState, targetWorkspaceId)
      : null,
    structuredRouteAvailable: aiVaultStructuredRouteAvailable(
      session,
      targetWorkspaceId,
      args.settings
    )
  })
  if (
    !eligibility.available ||
    !isAgentSessionHandleProvider(session.agent) ||
    resolveAgentSessionLaunchRoute(useAppStore.getState(), {
      agent: session.agent,
      workspace: {
        kind: workspaceKindForWorktreeId(eligibility.workspaceId),
        worktreeId: eligibility.workspaceId
      }
    }) !== 'structured-native-chat'
  ) {
    return { surface: 'terminal' }
  }
  return { surface: 'chat', workspaceId: eligibility.workspaceId }
}

export function resolveAiVaultSessionResumeInChatForWorkspace(args: {
  session: AiVaultSession
  resumeState: AiVaultSessionResumeState
  activeWorkspaceId: string | null
  targetState: AiVaultSessionResumeTargetState
  settings: AgentSessionStructuredFeasibilityRequest['settings']
}): AiVaultResumeInChatEligibility {
  const targetWorkspaceId = args.resumeState.usesSessionWorktree
    ? args.resumeState.worktreeId
    : (args.resumeState.worktreeId ?? args.activeWorkspaceId)
  const targetWorkspacePath = targetWorkspaceId
    ? resolveAiVaultTargetWorkspacePath(args.targetState, targetWorkspaceId)
    : null
  return resolveAiVaultSessionResumeInChatEligibility({
    session: args.session,
    targetWorkspaceId,
    targetWorkspacePath,
    structuredRouteAvailable: aiVaultStructuredRouteAvailable(
      args.session,
      targetWorkspaceId,
      args.settings
    )
  })
}

/** A history row's resume target and its resume-in-chat eligibility, composed once so every surface
 *  offering the row's moves (the Session History panel, the tab menu) asks the same questions. */
export function resolveAiVaultHistoryRowResume(
  args: Parameters<typeof resolveAiVaultHistorySessionResumeState>[0] & {
    targetState: AiVaultSessionResumeTargetState
    settings: AgentSessionStructuredFeasibilityRequest['settings']
  }
): { resumeState: AiVaultSessionResumeState; resumeInChat: AiVaultResumeInChatEligibility } {
  const { settings, ...resumeArgs } = args
  const resumeState = resolveAiVaultHistorySessionResumeState(resumeArgs)
  return {
    resumeState,
    resumeInChat: resolveAiVaultSessionResumeInChatForWorkspace({
      session: args.session,
      resumeState,
      activeWorkspaceId: args.activeWorktreeId,
      targetState: args.targetState,
      settings
    })
  }
}
