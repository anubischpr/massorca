import {
  buildReplySuggestionPrompt,
  normalizeReplySuggestionText,
  type ReplySuggestionExchange
} from '../../shared/native-chat-reply-suggestion'
import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import { cleanGeneratedCommitMessage } from '../../shared/commit-message-agent-output'
import type { ResolvedSourceControlAiGenerationParams } from '../../shared/source-control-ai'
import {
  commandBackslashMode,
  executeGenerationPlan
} from './source-control-text-generation-requests'
import type {
  CommitMessageGenerationTarget,
  SpawnSourceControlAgent
} from './source-control-text-generation-types'

/** A next-message guess is worth a few seconds, not the minute a commit message may take. */
export const REPLY_SUGGESTION_TIMEOUT_MS = 20_000

export type GenerateReplySuggestionResult =
  | { success: true; text: string }
  | { success: false; error: string; canceled?: boolean }

/** One short non-interactive agent call; a result that sanitizes to nothing is a failure. */
export async function generateReplySuggestion(input: {
  exchange: ReplySuggestionExchange
  params: ResolvedSourceControlAiGenerationParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
  timeoutMs?: number
}): Promise<GenerateReplySuggestionResult> {
  const planned = planCommitMessageGeneration(
    { ...input.params, backslash: commandBackslashMode(input.target) },
    buildReplySuggestionPrompt(input.exchange)
  )
  if (!planned.ok) {
    return { success: false, error: planned.error }
  }
  const result = await executeGenerationPlan({
    params: input.params,
    plan: planned.plan,
    target: input.target,
    spawnAgent: input.spawnAgent,
    emptyResultName: 'reply suggestion',
    operation: 'reply-suggestion',
    timeoutMs: input.timeoutMs ?? REPLY_SUGGESTION_TIMEOUT_MS
  })
  if (!result.success) {
    return { success: false, error: result.error, canceled: result.canceled }
  }
  const text = normalizeReplySuggestionText(cleanGeneratedCommitMessage(result.rawOutput))
  return text
    ? { success: true, text }
    : { success: false, error: 'Generated reply suggestion was empty after sanitization.' }
}
