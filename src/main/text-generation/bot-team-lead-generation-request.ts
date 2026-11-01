import { cleanGeneratedCommitMessage } from '../../shared/commit-message-agent-output'
import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import type { ResolvedSourceControlAiGenerationParams } from '../../shared/source-control-ai'
import {
  commandBackslashMode,
  executeGenerationPlan
} from './source-control-text-generation-requests'
import type {
  CommitMessageGenerationTarget,
  SpawnSourceControlAgent
} from './source-control-text-generation-types'

/** A person is waiting in the room; past this the room asks them instead. */
const BOT_TEAM_LEAD_TIMEOUT_MS = 45_000

/** One short non-interactive agent call. Null on any failure, so the room asks the person. */
export async function queryBotTeamLead(input: {
  prompt: string
  params: ResolvedSourceControlAiGenerationParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
}): Promise<string | null> {
  const planned = planCommitMessageGeneration(
    { ...input.params, backslash: commandBackslashMode(input.target) },
    input.prompt
  )
  if (!planned.ok) {
    return null
  }
  const result = await executeGenerationPlan({
    params: input.params,
    plan: planned.plan,
    target: input.target,
    spawnAgent: input.spawnAgent,
    emptyResultName: 'team lead choice',
    operation: 'reply-suggestion',
    timeoutMs: BOT_TEAM_LEAD_TIMEOUT_MS
  })
  return result.success ? cleanGeneratedCommitMessage(result.rawOutput) : null
}
