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
/** A researched reply is posted when it is ready, so it may search and read for longer. */
const BOT_TEAM_RESEARCH_TIMEOUT_MS = 120_000
/** A code question reads files across the checkout, so it may run longest. */
export const BOT_TEAM_CODE_READ_TIMEOUT_MS = 180_000

/**
 * One short non-interactive agent call. Null on any failure, so the room asks the person.
 * `webResearch` adds web search only where the agent has a confirmed web-only mode.
 */
export async function queryBotTeamLead(input: {
  prompt: string
  params: ResolvedSourceControlAiGenerationParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
  webResearch?: boolean
  /** Read-only code reading where the agent has a code read mode, else text only. */
  codeRead?: boolean
  /** The host's MCP limits for a code turn of a host-checked agent (see `resolveCodeReadHostArgs`). */
  codeReadHostArgs?: readonly string[]
}): Promise<string | null> {
  const planned = planCommitMessageGeneration(
    {
      ...input.params,
      backslash: commandBackslashMode(input.target),
      // Why: every bot-team one-shot is a room turn, so each agent's room isolation applies.
      roomTurn: true,
      ...(input.webResearch ? { webResearch: true } : {}),
      ...(input.codeRead ? { codeRead: true } : {}),
      ...(input.codeReadHostArgs ? { codeReadHostArgs: input.codeReadHostArgs } : {})
    },
    input.prompt
  )
  if (!planned.ok) {
    return null
  }
  // The marker is local: the plan that reaches a remote relay keeps its old shape.
  const { webResearch, codeRead, ...plan } = planned.plan
  const result = await executeGenerationPlan({
    params: input.params,
    plan,
    target: input.target,
    spawnAgent: input.spawnAgent,
    emptyResultName: 'team lead choice',
    operation: 'reply-suggestion',
    timeoutMs: codeRead
      ? BOT_TEAM_CODE_READ_TIMEOUT_MS
      : webResearch
        ? BOT_TEAM_RESEARCH_TIMEOUT_MS
        : BOT_TEAM_LEAD_TIMEOUT_MS
  })
  return result.success ? cleanGeneratedCommitMessage(result.rawOutput) : null
}
