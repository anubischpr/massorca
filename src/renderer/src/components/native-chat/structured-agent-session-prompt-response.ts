import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { supportsStructuredAgentSessionQuestionAnswers } from '@/runtime/structured-agent-session-client'
import {
  legacyAgentSessionSelectedOptionId,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session-question-answer'
import type { AgentSessionPromptResult } from '../../../../shared/agent-session-wire'
import type { PrototypeDesignSystemMode } from '../../../../shared/prototype-design-system-files'
import type { StructuredPromptItem } from './structured-agent-session-message-projection'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

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
  const promptTarget = { itemId: item.itemId, expectedRevision: item.revision }
  // Why: approvals take no count (their RPC is strict), so the field rides only a question's answer.
  const countField =
    item.body.kind !== 'question'
      ? {}
      : {
          ...(count === undefined ? {} : { count }),
          ...(designSystem === undefined ? {} : { designSystem })
        }
  let fields: Record<string, unknown>
  if (response.kind === 'option') {
    fields = { ...promptTarget, optionId: response.optionId }
  } else if (await supportsStructuredAgentSessionQuestionAnswers(target)) {
    // Negotiated before mutate fingerprints the call: older hosts reject the strict field.
    fields = { ...promptTarget, answers: response.answers, ...countField }
  } else {
    const optionId =
      item.body.kind === 'question'
        ? legacyAgentSessionSelectedOptionId(item.body, response.answers)
        : null
    if (optionId === null) {
      return null
    }
    // Why: a host that predates answers takes no count, so its default count applies.
    fields = { ...promptTarget, optionId }
  }
  return mutate<AgentSessionPromptResult>(
    item.body.kind === 'approval'
      ? 'agentSession.respondToApproval'
      : 'agentSession.respondToQuestion',
    `agentSession.respondTo:${item.body.kind}`,
    fields
  )
}
