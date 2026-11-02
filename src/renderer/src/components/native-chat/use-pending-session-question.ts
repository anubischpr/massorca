import { useCallback, useMemo } from 'react'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { AgentJournalQuestion } from '../../../../shared/agent-session-journal-types'
import {
  agentSessionPromptQuestions,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session-question-answer'
import type { AgentSessionPromptResult } from '../../../../shared/agent-session-wire'
import { pendingStructuredSessionQuestion } from '../../../../shared/structured-session-pending-question'
import type { StructuredPromptItem } from './structured-agent-session-message-projection'
import {
  cancelStructuredAgentSession,
  respondToStructuredAgentSessionPrompt
} from './structured-agent-session-prompt-response'
import { useStructuredAgentSessionTransport } from './use-structured-agent-session-transport'
import { useStructuredAgentSessionTransportState } from './use-structured-agent-session-transport-state'
import { useStructuredPromptResponseHold } from './use-structured-prompt-response-hold'

/** Stands in for the target while disabled; a disabled transport makes no call with it. */
const DISABLED_TARGET: RuntimeClientTarget = { kind: 'local' }

export type PendingSessionQuestion = {
  itemId: string
  revision: number
  /** The data the question card draws, as the thread passes it to the card. */
  prompt: { questions: readonly AgentJournalQuestion[]; delegation: unknown }
  /** True from an answer until the host refuses it, as the thread's card is held. */
  isSubmitting: boolean
  answer: (response: AgentSessionPromptResponse) => Promise<void>
  cancel: () => Promise<void>
}

/**
 * The question a structured session's chat card would draw, for a surface outside that chat.
 * Pass a null session or target while the surface does not show the question.
 */
export function usePendingSessionQuestion(
  sessionId: string | null,
  options: { target: RuntimeClientTarget | null; agent: AgentType }
): PendingSessionQuestion | null {
  const { agent, target } = options
  const enabled = sessionId !== null && target !== null
  const transport = useStructuredAgentSessionTransport({
    sessionId: sessionId ?? '',
    target: target ?? DISABLED_TARGET,
    isVisible: enabled,
    enabled
  })
  const { mutate } = transport
  const transportState = useStructuredAgentSessionTransportState(transport.state, enabled)
  const pending = useMemo(
    () => pendingStructuredSessionQuestion(transportState.journalItems),
    [transportState.journalItems]
  )
  const respond = useCallback(
    (
      item: StructuredPromptItem,
      response: AgentSessionPromptResponse
    ): Promise<AgentSessionPromptResult | null> =>
      target === null
        ? Promise.resolve(null)
        : respondToStructuredAgentSessionPrompt({ item, response, target, mutate }),
    [mutate, target]
  )
  const hold = useStructuredPromptResponseHold(respond)
  if (pending === null || target === null) {
    return null
  }
  const { turnId } = transportState
  return {
    itemId: pending.itemId,
    revision: pending.revision,
    prompt: {
      questions: agentSessionPromptQuestions(pending.body),
      delegation: pending.body.delegation
    },
    isSubmitting: hold.holds(pending),
    answer: async (response) => {
      await hold.respond(pending, response)
    },
    cancel: async () => {
      // The thread's card cancels inside a running turn, or for a pi session, which can hold a prompt without one.
      if (!turnId && agent !== 'pi') {
        return
      }
      await cancelStructuredAgentSession({
        turnId: turnId ?? undefined,
        prompt: { itemId: pending.itemId, expectedRevision: pending.revision },
        target,
        mutate
      })
    }
  }
}
