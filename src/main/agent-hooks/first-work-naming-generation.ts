import type { GlobalSettings } from '../../shared/global-settings-types'
import { getCommitMessageAgentSpec } from '../../shared/commit-message-agent-spec'
import {
  CREATE_CHAT_NAMING_DISCOVERY_AGENTS,
  selectCreateChatNamingModel,
  type CreateChatNamingOverride,
  type DiscoveredNamingModel
} from '../../shared/create-chat-session-naming'
import type { TuiAgent } from '../../shared/tui-agent'
import type { SshGitProvider } from '../providers/ssh-git-provider'
import {
  discoverCommitMessageModelsLocal,
  discoverCommitMessageModelsRemote,
  type CommitMessageGenerationTarget,
  type GenerateCommitMessageParams
} from '../text-generation/commit-message-text-generation'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { resolveGenerationTarget } from './first-work-generation-target'

export type FirstWorkNamingGeneration = {
  params: GenerateCommitMessageParams
  /** Null when the generation environment cannot be prepared; the caller retries later. */
  target: CommitMessageGenerationTarget | null
}

export type FirstWorkNamingDeps = {
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
}

/**
 * Generation params and target for a first-work rename. A create-chat workspace names with its
 * session's agent and the model its CLI discovery reports; every other workspace keeps the global
 * Source Control AI params.
 */
export async function resolveFirstWorkNamingGeneration(args: {
  globalParams: GenerateCommitMessageParams
  createChatNaming: (CreateChatNamingOverride & { agentId: TuiAgent }) | undefined
  settings: GlobalSettings
  worktreePath: string
  provider: SshGitProvider | null
  deps: FirstWorkNamingDeps
}): Promise<FirstWorkNamingGeneration> {
  const { globalParams, createChatNaming, settings, worktreePath, provider, deps } = args
  if (!createChatNaming) {
    return {
      params: globalParams,
      target: await resolveGenerationTarget(worktreePath, globalParams.agentId, provider, deps)
    }
  }
  const { agentId } = createChatNaming
  const agentCommandOverride = settings.agentCmdOverrides?.[agentId]?.trim() || undefined
  const target = await resolveGenerationTarget(worktreePath, agentId, provider, deps)
  if (!target) {
    return { params: globalParams, target: null }
  }
  const discoveredModels = CREATE_CHAT_NAMING_DISCOVERY_AGENTS.has(agentId)
    ? await discoverNamingModels({ agentId, agentCommandOverride, worktreePath, provider, target })
    : []
  const choice = selectCreateChatNamingModel({
    agentId,
    discoveredModels,
    pickedModel: createChatNaming.model,
    specDefaultModelId: getCommitMessageAgentSpec(agentId)?.defaultModelId
  })
  if (choice.kind === 'global') {
    return {
      params: globalParams,
      target: await resolveGenerationTarget(worktreePath, globalParams.agentId, provider, deps)
    }
  }
  return {
    params: {
      agentId,
      // Why: an empty model makes the agent spec omit its model flag, so the CLI's own default runs.
      model: choice.kind === 'model' ? choice.modelId : '',
      ...(globalParams.customPrompt !== undefined
        ? { customPrompt: globalParams.customPrompt }
        : {}),
      ...(globalParams.commandInputTemplate !== undefined
        ? { commandInputTemplate: globalParams.commandInputTemplate }
        : {}),
      ...(agentCommandOverride ? { agentCommandOverride } : {})
    },
    target
  }
}

async function discoverNamingModels(args: {
  agentId: TuiAgent
  agentCommandOverride: string | undefined
  worktreePath: string
  provider: SshGitProvider | null
  target: CommitMessageGenerationTarget
}): Promise<DiscoveredNamingModel[]> {
  const { agentId, agentCommandOverride, worktreePath, provider, target } = args
  // Why: discovery runs where the workspace's git runs, so SSH names come from the remote CLI.
  const result = provider
    ? await discoverCommitMessageModelsRemote(
        agentId,
        worktreePath,
        (plan, cwd, timeoutMs) => provider.executeCommitMessagePlan(plan, cwd, timeoutMs),
        agentCommandOverride
      )
    : await discoverCommitMessageModelsLocal(
        agentId,
        target.kind === 'local' ? target.env : undefined,
        agentCommandOverride,
        { cwd: worktreePath }
      )
  return result.success ? result.models : []
}
