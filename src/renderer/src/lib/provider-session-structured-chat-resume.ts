import { useAppStore } from '@/store'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import type { AgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import {
  activateAndRevealFolderWorkspace,
  activateAndRevealWorktree
} from '@/lib/worktree-activation'
import {
  beginStructuredAgentSessionProvisionalLaunch,
  type StructuredAgentSessionProvisionalLaunch
} from '@/lib/structured-agent-session-provisional-tab'
import type { AgentSessionAdoptableProvider } from '../../../shared/agent-session-provider-handle'
import { parseWorkspaceKey } from '../../../shared/workspace-scope'

export type ResumeProviderSessionInNewChatArgs = {
  agent: AgentSessionAdoptableProvider
  worktreeId: string
  /** The provider's own conversation id; the host resumes exactly this conversation. */
  providerSessionId: string
  /** The user action this adoption serves, minted where that action is handled. */
  requestId: AgentLaunchRequestId
  /** Hears a launch that started and then failed, unless the launch already told the user. */
  onFailed: (error: unknown) => void
}

/** Reveals the workspace a chat opens in, whether it is a git worktree or a folder workspace. */
export function activateStructuredChatWorkspace(workspaceId: string): boolean {
  const workspaceScope = parseWorkspaceKey(workspaceId)
  if (workspaceScope?.type === 'folder') {
    return activateAndRevealFolderWorkspace(workspaceScope.folderWorkspaceId) !== false
  }
  return activateAndRevealWorktree(workspaceId) !== false
}

/**
 * Adopts a provider session the host already holds into a new structured chat. A host refusal
 * reaches `onFailed`; a launch that cannot begin throws to the caller.
 */
export function resumeProviderSessionInNewStructuredChat(
  args: ResumeProviderSessionInNewChatArgs
): StructuredAgentSessionProvisionalLaunch | null {
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: args.requestId,
    agent: args.agent,
    worktreeId: args.worktreeId,
    resumeFrom: { providerSessionId: args.providerSessionId }
  })
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    beforeOpen: () => {
      if (useAppStore.getState().activeWorktreeId !== args.worktreeId) {
        return activateStructuredChatWorkspace(args.worktreeId)
      }
      return true
    }
  })
  if (launch) {
    void launch.settlement.then((settlement) => {
      if (settlement.kind === 'failed' && !settlement.notified) {
        args.onFailed(settlement.error)
      }
    })
  }
  return launch
}
