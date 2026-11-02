import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { BOT_TEAMS_FOLDER_NAME } from '../../shared/bot-team-folder'
import {
  getCommitMessageAgentSpec,
  resolveCommitMessageAgentChoice
} from '../../shared/commit-message-agent-spec'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import { queryBotTeamLead } from '../text-generation/bot-team-lead-generation-request'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'

type LeadQuerySettings = Pick<GlobalSettings, 'defaultTuiAgent' | 'disabledTuiAgents'> &
  Partial<Pick<GlobalSettings, 'agentCmdOverrides'>>

/** Asks the Settings default agent one short question. Null when it cannot answer, so the room asks. */
export async function askDefaultAgentForBotTeamLead(args: {
  prompt: string
  settings: LeadQuerySettings
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
}): Promise<string | null> {
  try {
    return await runLeadQuery(args)
  } catch {
    return null
  }
}

async function runLeadQuery(args: {
  prompt: string
  settings: LeadQuerySettings
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
  // Runs in the teams' folder, not the person's home, so the query has nothing else at hand.
  const cwd = path.join(homedir(), BOT_TEAMS_FOLDER_NAME)
  await mkdir(cwd, { recursive: true })
  const target = await resolveGenerationTarget(cwd, agentId, null, { getAgentEnvResolvers })
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
