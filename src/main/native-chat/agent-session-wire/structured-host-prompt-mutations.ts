// A host-owned question's answer and Cancel as client mutations. Both are conversation writes: no
// provider child answers them, so neither needs a live owner, and a Cancel ends only the question,
// never the chat's turn.

import type {
  AgentSessionCancelResult,
  AgentSessionMutationEnvelope,
  AgentSessionMutationResult,
  AgentSessionPromptResult
} from '../../../shared/agent-session-wire'
import type { StructuredAgentSessionCaller } from './structured-agent-session-host-types'
import { mutateStructuredAgentSession } from './structured-agent-session-mutation-context'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-mutation-context'
import { cancelPlan, promptPlan } from './structured-agent-session-mutation-plans'
import { cancelHostOwnedPrompt } from './structured-agent-session-prompt-cancel'
import { openForWrite } from './structured-agent-session-send-preparation'
import type { AgentSessionPromptRequest } from './structured-agent-session-turns-prompt'

export function respondToHostPrompt(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSessionPromptRequest & { envelope: AgentSessionMutationEnvelope }
): Promise<AgentSessionMutationResult<AgentSessionPromptResult>> {
  return mutateStructuredAgentSession(
    context,
    caller,
    params.envelope,
    { ...promptPlan(params), conversationWrite: true },
    openForWrite(context, params.envelope)
  )
}

export function cancelHostPrompt(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: {
    envelope: AgentSessionMutationEnvelope
    turnId?: string
    prompt: { itemId: string; expectedRevision: number }
  }
): Promise<AgentSessionMutationResult<AgentSessionCancelResult>> {
  const { prompt } = params
  return mutateStructuredAgentSession(
    context,
    caller,
    params.envelope,
    {
      ...cancelPlan(params),
      conversationWrite: true,
      run: (ctx) =>
        cancelHostOwnedPrompt(ctx, {
          ...(params.turnId !== undefined ? { turnId: params.turnId } : {}),
          prompt
        })
    },
    openForWrite(context, params.envelope)
  )
}
