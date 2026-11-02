import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import {
  supportsStructuredAgentSessionPromptCancel,
  supportsStructuredAgentSessionQuestionAnswers
} from '@/runtime/structured-agent-session-client'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import type { AgentSessionPromptResult } from '../../../../shared/agent-session-wire'
import { structuredQuestionAnswerFields } from '../../../../shared/structured-session-pending-question'
import type { StructuredPromptItem } from './structured-agent-session-message-projection'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

/** The prompt a cancel names: the card's journal item and the revision the card shows. */
export type StructuredPromptCancelTarget = { itemId: string; expectedRevision: number }

export async function respondToStructuredAgentSessionPrompt({
  item,
  response,
  target,
  mutate
}: {
  item: StructuredPromptItem
  response: AgentSessionPromptResponse
  target: RuntimeClientTarget
  mutate: StructuredAgentSessionMutate
}): Promise<AgentSessionPromptResult | null> {
  const fields = await promptResponseFields(item, response, target)
  if (fields === null) {
    return null
  }
  return mutate<AgentSessionPromptResult>(
    item.body.kind === 'approval'
      ? 'agentSession.respondToApproval'
      : 'agentSession.respondToQuestion',
    `agentSession.respondTo:${item.body.kind}`,
    fields
  )
}

async function promptResponseFields(
  item: StructuredPromptItem,
  response: AgentSessionPromptResponse,
  target: RuntimeClientTarget
): Promise<Record<string, unknown> | null> {
  if (response.kind === 'option') {
    return { itemId: item.itemId, expectedRevision: item.revision, optionId: response.optionId }
  }
  // Negotiated before mutate fingerprints the call: older hosts reject the strict field.
  const hostTakesAnswers = await supportsStructuredAgentSessionQuestionAnswers(target)
  if (item.body.kind === 'question') {
    return structuredQuestionAnswerFields(
      { itemId: item.itemId, revision: item.revision, body: item.body },
      response,
      hostTakesAnswers
    )
  }
  return hostTakesAnswers
    ? { itemId: item.itemId, expectedRevision: item.revision, answers: response.answers }
    : null
}

/** The cancel a prompt card sends: its turn, naming the prompt when the host takes one. */
export async function cancelStructuredAgentSession({
  turnId,
  prompt,
  target,
  mutate
}: {
  turnId: string | undefined
  prompt: StructuredPromptCancelTarget | undefined
  target: RuntimeClientTarget
  mutate: StructuredAgentSessionMutate
}): Promise<unknown> {
  // Capability negotiation must complete before mutate fingerprints the payload:
  // older hosts reject the strict prompt field.
  const promptSupported =
    prompt !== undefined && (await supportsStructuredAgentSessionPromptCancel(target))
  return mutate('agentSession.cancel', 'agentSession.cancel', {
    ...(turnId ? { turnId } : {}),
    ...(promptSupported ? { prompt } : {})
  })
}
