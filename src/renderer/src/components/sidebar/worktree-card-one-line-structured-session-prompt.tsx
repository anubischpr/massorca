import React, { useEffect, useRef, useState } from 'react'

import { NativeChatApprovalCard } from '@/components/native-chat/NativeChatApprovalCard'
import { NativeChatStructuredQuestionCard } from '@/components/native-chat/NativeChatStructuredQuestionCard'
import { chatApprovalFromJournal } from '@/components/native-chat/native-chat-interactive-prompt'
import {
  pendingStructuredSessionPrompts,
  type StructuredPromptItem
} from '@/components/native-chat/structured-agent-session-message-projection'
import { respondToStructuredAgentSessionPrompt } from '@/components/native-chat/structured-agent-session-prompt-response'
import { useStructuredAgentSessionMutate } from '@/components/native-chat/use-structured-agent-session-mutate'
import { useStructuredAgentSessionRead } from '@/components/native-chat/use-structured-agent-session-read'
import { useStructuredAgentSessionTransportState } from '@/components/native-chat/use-structured-agent-session-transport-state'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { supportsStructuredAgentSessionPromptCancel } from '@/runtime/structured-agent-session-client'
import {
  agentSessionPromptQuestions,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session-question-answer'
import { pendingPromptsAllUnanswerableHere } from '../../../../shared/agent-session-approval-subject'

/** The prompt a hover can answer: the session's first, unless none can be answered from here. */
export function structuredHoverPrompt(
  prompts: StructuredPromptItem[]
): StructuredPromptItem | null {
  return pendingPromptsAllUnanswerableHere(prompts) ? null : (prompts[0] ?? null)
}

/**
 * Answers a structured session's pending prompt from its hover card. It reads the journal only while
 * the card is open, holds no provider and counts as no view, so the prompt stays unread until the
 * chat is opened. With nothing to answer yet it shows `fallback`.
 */
export default function OneLineStructuredSessionPrompt({
  sessionId,
  target,
  agent,
  fallback,
  onDone
}: {
  sessionId: string
  target: RuntimeClientTarget
  agent: string
  fallback: React.ReactNode
  onDone: () => void
}): React.JSX.Element {
  const read = useStructuredAgentSessionRead({
    sessionId,
    target,
    isVisible: true,
    isViewed: false
  })
  const stateRef = useRef(read.state)
  useEffect(() => {
    stateRef.current = read.state
  }, [read.state])
  const { mutate } = useStructuredAgentSessionMutate({ sessionId, target, stateRef })
  const { journalItems, turnId } = useStructuredAgentSessionTransportState(read.state, true)
  const [submittedKey, setSubmittedKey] = useState<string | null>(null)
  const prompt = structuredHoverPrompt(pendingStructuredSessionPrompts(journalItems))
  if (!prompt) {
    return <>{fallback}</>
  }
  const promptKey = `${prompt.itemId}:${prompt.revision}`
  const respond = (response: AgentSessionPromptResponse, count?: number): void => {
    setSubmittedKey(promptKey)
    void respondToStructuredAgentSessionPrompt({ item: prompt, response, target, mutate, count })
      .then((result) => {
        if (result === null) {
          setSubmittedKey(null)
        } else {
          onDone()
        }
      })
      .catch(() => setSubmittedKey(null))
  }
  const cancel = (): void => {
    if (!turnId && agent !== 'pi') {
      return
    }
    void supportsStructuredAgentSessionPromptCancel(target).then((supported) =>
      mutate('agentSession.cancel', 'agentSession.cancel', {
        ...(turnId ? { turnId } : {}),
        ...(supported
          ? { prompt: { itemId: prompt.itemId, expectedRevision: prompt.revision } }
          : {})
      })
    )
    onDone()
  }
  const isSubmitting = submittedKey === promptKey
  if (prompt.body.kind === 'approval') {
    return (
      <NativeChatApprovalCard
        key={promptKey}
        approval={chatApprovalFromJournal(prompt.body)}
        onChoose={(optionId) => respond({ kind: 'option', optionId })}
        isSubmitting={isSubmitting}
        onCancel={cancel}
      />
    )
  }
  return (
    <NativeChatStructuredQuestionCard
      key={promptKey}
      questions={agentSessionPromptQuestions(prompt.body)}
      delegation={prompt.body.delegation}
      onAnswer={respond}
      isSubmitting={isSubmitting}
      onCancel={cancel}
    />
  )
}
