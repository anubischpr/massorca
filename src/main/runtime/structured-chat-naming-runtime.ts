import type { Store } from '../persistence'
import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../shared/execution-host'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import type { StructuredChatNamingDeps } from '../native-chat/structured-chat-naming'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { firstStructuredChatNamingPrompt } from '../../shared/structured-chat-naming-eligibility'
import { LOCAL_COMMIT_MESSAGE_HOST_KEY } from '../../shared/commit-message-host-key'
import {
  generateConversationNameFromContext,
  resolveTextGenerationParams
} from '../text-generation/commit-message-text-generation'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import { firstWorkRenameDeps } from '../agent-hooks/first-work-rename-runtime'
import {
  nameDelegatedChildWorktree,
  type DelegatedChildWorktreeNameDeps
} from '../delegated-session/delegated-child-worktree-name'
import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'

type StructuredChatNamingRuntime = {
  resolveWorkspace: (
    workspaceId: string
  ) => Promise<{ path: string; executionHostId: ExecutionHostId }>
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
  retitleOpenTab: (workspaceId: string, sessionId: string) => void
  delegatedChild: DelegatedChildWorktreeNameDeps
}

/** What a delegated child's title needs from this host: its store, its orchestration DB, its rename path. */
export type DelegatedChildNamingHost = Parameters<typeof firstWorkRenameDeps>[1] & {
  requireStore: () => Store
  getExistingOrchestrationDb: () => {
    isWorktreeCreatedAsDelegatedChild: (worktreeId: string) => boolean
  } | null
  resolveRuntimeFileTarget: (selector: string) => Promise<{ worktree: { branch: string } }>
}

export function delegatedChildWorktreeNameDeps(
  host: DelegatedChildNamingHost
): DelegatedChildWorktreeNameDeps {
  return {
    isDelegatedChild: (worktreeId) =>
      host.getExistingOrchestrationDb()?.isWorktreeCreatedAsDelegatedChild(worktreeId) ?? false,
    getMeta: (worktreeId) => host.requireStore().getWorktreeMeta(worktreeId),
    resolveBranch: async (worktreeId) =>
      (await host.resolveRuntimeFileTarget(`id:${worktreeId}`)).worktree.branch,
    renameWorktree: (worktreeId, displayName) => {
      // Why: the same setter a first-message title uses, so the catalog and sidebar refresh alike.
      const titleDeps = firstWorkRenameDeps(host.requireStore(), host)
      titleDeps.setDisplayName(worktreeId, displayName)
      titleDeps.onRenamed(getRepoIdFromWorktreeId(worktreeId))
    }
  }
}

export function structuredChatNamingDeps(
  getStore: () => Pick<Store, 'getSettings'>,
  runtime: StructuredChatNamingRuntime,
  logger: StructuredAgentSessionLogger
): StructuredChatNamingDeps {
  return {
    getStore: () => getStructuredAgentSessionHost()?.deps.store ?? null,
    getSettings: () => getStore().getSettings(),
    readFirstPrompt: async (sessionId, hostStartedAt) => {
      const host = getStructuredAgentSessionHost()
      return host
        ? firstStructuredChatNamingPrompt(await host.journalSnapshot(sessionId), hostStartedAt)
        : ''
    },
    generate: async (record, firstPrompt) => {
      const settings = resolveTextGenerationParams(
        getStore().getSettings(),
        LOCAL_COMMIT_MESSAGE_HOST_KEY,
        'conversationName',
        null
      )
      if (!settings.ok) {
        logger.warn(settings.error, { scope: 'conversation-name', sessionId: record.sessionId })
        return null
      }
      const workspace = await runtime.resolveWorkspace(record.location.workspaceId)
      // Structured chats execute natively on this host; an SSH workspace must never fall back here.
      if (
        workspace.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
        record.location.wslDistro !== null
      ) {
        throw new Error('Chat name generation target is not this native execution host')
      }
      const target = await resolveGenerationTarget(
        workspace.path,
        settings.params.agentId,
        null,
        runtime
      )
      if (!target) {
        return null
      }
      const result = await generateConversationNameFromContext(
        { firstPrompt },
        settings.params,
        target
      )
      if (!result.success) {
        logger.warn(result.error, { scope: 'conversation-name', sessionId: record.sessionId })
        return null
      }
      return result.name
    },
    onNamed: (workspaceId, sessionId, conversationName) => {
      try {
        // Lists that show the chat without its tab, a closed one too, learn the name from the feed.
        getStructuredAgentSessionHost()?.publishConversationName(sessionId)
      } catch (error) {
        logger.warn('Chat name publication failed', {
          scope: 'conversation-name',
          sessionId,
          error
        })
      }
      runtime.retitleOpenTab(workspaceId, sessionId)
      // Runs on the host that owns the chat, so a remote chat is titled in its own store.
      void nameDelegatedChildWorktree(workspaceId, conversationName, runtime.delegatedChild).catch(
        (error: unknown) =>
          logger.warn('Delegated child worktree naming failed', {
            scope: 'conversation-name',
            sessionId,
            error
          })
      )
    },
    logger
  }
}
