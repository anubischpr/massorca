import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { BOT_TEAMS_FOLDER_NAME } from '../../shared/bot-team-folder'
import {
  getCommitMessageAgentSpec,
  resolveCommitMessageAgentChoice
} from '../../shared/commit-message-agent-spec'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { isTuiAgent } from '../../shared/tui-agent-config'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import { queryBotTeamLead } from '../text-generation/bot-team-lead-generation-request'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'

type RequestQuerySettings = Pick<GlobalSettings, 'defaultTuiAgent' | 'disabledTuiAgents'> &
  Partial<Pick<GlobalSettings, 'agentCmdOverrides'>>

type QueryArgs = {
  prompt: string
  settings: RequestQuerySettings
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
}

/** A bot's own agent for one reply, at the model and effort chosen for it. */
export type BotQueryAgent = { id: string; model: string | null; effort: string | null }

/** Asks the Settings default agent one short question. Null when it cannot answer, so the room asks. */
export async function askDefaultAgentForBotTeamRequest(args: QueryArgs): Promise<string | null> {
  return askAgent(args)
}

/**
 * Asks a bot's own agent one short question. An agent the one-shot call does not know, or that is
 * Gentle Shell (which must never run as stock Pi), falls back to the Settings default agent.
 */
export async function askBotAgentForBotTeamReply(
  args: QueryArgs & { agent: BotQueryAgent | null }
): Promise<string | null> {
  return askAgent(args, args.agent)
}

async function askAgent(args: QueryArgs, bot: BotQueryAgent | null = null): Promise<string | null> {
  try {
    return await runAgentQuery(args, bot)
  } catch {
    return null
  }
}

async function runAgentQuery(args: QueryArgs, bot: BotQueryAgent | null): Promise<string | null> {
  const { prompt, settings, getAgentEnvResolvers } = args
  const ownId = bot && isTuiAgent(bot.id) && getCommitMessageAgentSpec(bot.id) ? bot.id : null
  const own = ownId === null ? null : bot
  const agentId =
    ownId ??
    resolveCommitMessageAgentChoice(null, settings.defaultTuiAgent, settings.disabledTuiAgents)
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
      model: own?.model ?? spec.defaultModelId,
      ...(own?.model && own.effort ? { thinkingLevel: own.effort } : {}),
      ...(override ? { agentCommandOverride: override } : {})
    },
    target,
    spawnAgent: spawnSourceControlAgent
  })
}
