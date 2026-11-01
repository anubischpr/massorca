import { homedir } from 'node:os'
import {
  getCommitMessageAgentSpec,
  resolveCommitMessageAgentChoice
} from '../../shared/commit-message-agent-spec'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import { queryBotTeamLead } from '../text-generation/bot-team-lead-generation-request'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'

/** Asks the Settings default agent one short question. Null when it cannot answer. */
export async function askDefaultAgentForBotTeamLead(args: {
  prompt: string
  settings: Pick<GlobalSettings, 'defaultTuiAgent' | 'disabledTuiAgents'> &
    Partial<Pick<GlobalSettings, 'agentCmdOverrides'>>
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
}): Promise<string | null> {
  const { prompt, settings, getAgentEnvResolvers } = args
  const agentId = resolveCommitMessageAgentChoice(
    null,
    settings.defaultTuiAgent,
    settings.disabledTuiAgents
  )
  const spec = agentId && agentId !== 'custom' ? getCommitMessageAgentSpec(agentId) : undefined
  if (!agentId || agentId === 'custom' || !spec) {
    return null
  }
  const target = await resolveGenerationTarget(homedir(), agentId, null, { getAgentEnvResolvers })
  if (!target) {
    return null
  }
  const override = settings.agentCmdOverrides?.[agentId]?.trim()
  return queryBotTeamLead({
    prompt,
    params: {
      agentId,
      model: spec.defaultModelId,
      ...(override ? { agentCommandOverride: override } : {})
    },
    target,
    spawnAgent: spawnSourceControlAgent
  })
}
