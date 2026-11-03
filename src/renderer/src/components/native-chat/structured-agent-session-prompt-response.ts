import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import {
  supportsStructuredAgentSessionPromptCancel,
  supportsStructuredAgentSessionQuestionAnswers
} from '@/runtime/structured-agent-session-client'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import type { AgentSessionPromptResult } from '../../../../shared/agent-session-wire'
import type { PrototypeDesignSystemMode } from '../../../../shared/prototype-design-system-files'
import { structuredQuestionAnswerFields } from '../../../../shared/structured-session-pending-question'
import type { StructuredPromptItem } from './structured-agent-session-message-projection'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

/** The prompt a cancel names: the card's journal item and the revision the card shows. */
export type StructuredPromptCancelTarget = { itemId: string; expectedRevision: number }

export async function respondToStructuredAgentSessionPrompt({
  item,
  response,
  target,
  mutate,
  count,
  designSystem
}: {
  item: Pick<StructuredPromptItem, 'itemId' | 'revision' | 'body'>
  response: AgentSessionPromptResponse
  target: RuntimeClientTarget
  mutate: StructuredAgentSessionMutate
  /** The prototype count a delegated task's card picked; only a question's answer carries it. */
  count?: number
  /** The design system choice a delegated task's card picked; only a question's answer carries it. */
  designSystem?: PrototypeDesignSystemMode
}): Promise<AgentSessionPromptResult | null> {
  // Why: approvals take no count (their RPC is strict), so these ride only a question's answers.
  const extras = {
    ...(count === undefined ? {} : { count }),
    ...(designSystem === undefined ? {} : { designSystem })
  }
  const fields = await promptResponseFields(item, response, target, extras)
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
  item: Pick<StructuredPromptItem, 'itemId' | 'revision' | 'body'>,
  response: AgentSessionPromptResponse,
  target: RuntimeClientTarget,
  extras: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (response.kind === 'option') {
    return { itemId: item.itemId, expectedRevision: item.revision, optionId: response.optionId }
  }
  // Negotiated before mutate fingerprints the call: older hosts reject the strict field.
  const hostTakesAnswers = await supportsStructuredAgentSessionQuestionAnswers(target)
  if (item.body.kind === 'question') {
    const fields = structuredQuestionAnswerFields(
      { itemId: item.itemId, revision: item.revision, body: item.body },
      response,
      hostTakesAnswers
    )
    // A host that predates answers takes no count, so its default count applies.
    return fields && 'answers' in fields ? { ...fields, ...extras } : fields
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
