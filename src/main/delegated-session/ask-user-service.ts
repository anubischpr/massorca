import { randomUUID } from 'node:crypto'
import {
  askUserQuestionItemId,
  askUserQuestionRowIdentity,
  askUserRequestIdOfQuestionItem,
  buildAskUserQuestionBody,
  formatAskUserAnswers,
  readAskUserAnswers,
  type AskUserQuestionsInputValue
} from '../../shared/agent-ask-user-journal'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity,
  AgentJournalQuestionItem
} from '../../shared/agent-session-journal-types'
import {
  agentSessionPromptQuestions,
  legacyAgentSessionQuestionAnswers,
  type AgentSessionQuestionAnswer
} from '../../shared/agent-session-question-answer'
import type { AskUserResult } from '../../shared/rpc-contract/orchestration-ask-user-params'
import {
  boundJournalPromptBody,
  cancelledJournalPromptBody
} from '../native-chat/agent-session-journal/journal-prompt-body-bounds'
import type { StructuredAgentSessionHostOwnedPrompts } from '../native-chat/agent-session-wire/structured-agent-session-host-owned-prompts'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'

export type AskUserServiceDeps = {
  /** Whether this host holds the chat; a card can only be posted where its answer comes back. */
  holdsSession: (sessionId: string) => boolean
  rows: {
    appendHostRow: (
      sessionId: string,
      identity: AgentJournalItemIdentity,
      body: AgentJournalItemBody
    ) => Promise<unknown>
  }
}

type Settlement =
  | { kind: 'answered'; answers: AgentSessionQuestionAnswer[] }
  | { kind: 'cancelled' }

type PendingAsk = {
  sessionId: string
  body: AgentJournalQuestionItem
  settle: (settlement: Settlement) => void
}

type HostOwnedAnswer = Awaited<ReturnType<StructuredAgentSessionHostOwnedPrompts['answer']>>

function gone(message: string): HostOwnedAnswer {
  return { ok: false, reason: 'promptGone', message }
}

/**
 * Posts an agent's question to its own chat as the native question card and waits for the person.
 * The waiter lives in memory: the command that asked is the only reader, and it dies with the host.
 */
export class AskUserService {
  private readonly pending = new Map<string, PendingAsk>()

  constructor(private readonly deps: AskUserServiceDeps) {}

  readonly hostOwnedPrompts: StructuredAgentSessionHostOwnedPrompts = {
    answer: async (input) => this.answer(input),
    cancel: async (input) => this.cancel(input)
  }

  async ask(input: {
    sessionId: string
    questions: AskUserQuestionsInputValue
    timeoutMs: number
    signal?: AbortSignal
  }): Promise<AskUserResult> {
    if (!this.deps.holdsSession(input.sessionId)) {
      throw new OrchestrationError(
        'ask_user_session_unavailable',
        `Chat ${input.sessionId} is not held by this host, so it cannot show a question. Nothing was asked.`,
        { effectsApplied: false }
      )
    }
    const requestId = randomUUID()
    const questionItemId = askUserQuestionItemId(requestId)
    const body = boundJournalPromptBody(buildAskUserQuestionBody(input.questions))
    let settle: (settlement: Settlement) => void = () => undefined
    const settled = new Promise<Settlement>((resolve) => {
      settle = resolve
    })
    // Registered before the card can be seen, so an answer never arrives with nobody waiting.
    this.pending.set(requestId, { sessionId: input.sessionId, body, settle })
    try {
      await this.deps.rows.appendHostRow(
        input.sessionId,
        askUserQuestionRowIdentity(requestId),
        body
      )
    } catch (error) {
      this.pending.delete(requestId)
      throw error
    }
    const outcome = await this.waitFor(settled, input.timeoutMs, input.signal)
    this.pending.delete(requestId)
    if (outcome.kind === 'answered') {
      const answers = readAskUserAnswers(agentSessionPromptQuestions(body), outcome.answers)
      return { status: 'answered', questionItemId, answers, answer: formatAskUserAnswers(answers) }
    }
    if (outcome.kind === 'timedOut' || outcome.kind === 'aborted') {
      await this.withdrawCard(input.sessionId, requestId, body)
    }
    return { status: outcome.kind === 'cancelled' ? 'cancelled' : 'timedOut', questionItemId }
  }

  private waitFor(
    settled: Promise<Settlement>,
    timeoutMs: number,
    signal: AbortSignal | undefined
  ): Promise<Settlement | { kind: 'timedOut' } | { kind: 'aborted' }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish({ kind: 'timedOut' }), timeoutMs)
      const onAbort = (): void => finish({ kind: 'aborted' })
      function finish(value: Settlement | { kind: 'timedOut' } | { kind: 'aborted' }): void {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      }
      if (signal?.aborted) {
        finish({ kind: 'aborted' })
        return
      }
      signal?.addEventListener('abort', onAbort)
      void settled.then(finish)
    })
  }

  /** A card nobody waits for any more must not keep the chat waiting on its person. */
  private async withdrawCard(
    sessionId: string,
    requestId: string,
    body: AgentJournalQuestionItem
  ): Promise<void> {
    const cancelled = cancelledJournalPromptBody(body)
    if (!cancelled) {
      return
    }
    try {
      await this.deps.rows.appendHostRow(
        sessionId,
        askUserQuestionRowIdentity(requestId),
        cancelled
      )
    } catch (error) {
      console.warn('[ask-user] withdrawing an unanswered question card failed', error)
    }
  }

  private find(sessionId: string, itemId: string): [string, PendingAsk] | null {
    const requestId = askUserRequestIdOfQuestionItem(itemId)
    const entry = requestId ? this.pending.get(requestId) : undefined
    return requestId && entry && entry.sessionId === sessionId ? [requestId, entry] : null
  }

  private answer(input: { sessionId: string; itemId: string; optionId: string }): HostOwnedAnswer {
    const found = this.find(input.sessionId, input.itemId)
    if (!found) {
      return gone(`Nobody is waiting for the answer to ${input.itemId} any more.`)
    }
    const [requestId, entry] = found
    // The wire hands a host-owned card its answer in the packed form; grouped answers decode from it.
    const answers = legacyAgentSessionQuestionAnswers(entry.body, input.optionId)
    if (!answers) {
      return {
        ok: false,
        reason: 'optionRejected',
        message: `The answer does not match the questions on ${input.itemId}.`
      }
    }
    // Claimed now, delivered once the journal holds the answer; a failed write puts it back.
    this.pending.delete(requestId)
    return {
      ok: true,
      afterCommit: () => entry.settle({ kind: 'answered', answers }),
      rollback: () => {
        this.pending.set(requestId, entry)
      }
    }
  }

  private cancel(input: { sessionId: string; itemId: string }): HostOwnedAnswer {
    const found = this.find(input.sessionId, input.itemId)
    if (!found) {
      return gone(`Nobody is waiting for the answer to ${input.itemId} any more.`)
    }
    const [requestId, entry] = found
    this.pending.delete(requestId)
    return {
      ok: true,
      afterCommit: () => entry.settle({ kind: 'cancelled' }),
      rollback: () => {
        this.pending.set(requestId, entry)
      }
    }
  }
}
