import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import {
  encodeAgentSessionQuestionAnswers,
  legacyAgentSessionSelectedOptionId
} from '../../shared/agent-session-question-answer'
import { delegationQuestionItemId } from '../../shared/delegated-session-journal'
import {
  isHostOwnedPromptItemId,
  routeHostOwnedPrompts,
  type StructuredAgentSessionHostOwnedPrompts
} from '../native-chat/agent-session-wire/structured-agent-session-host-owned-prompts'
import { AskUserService } from './ask-user-service'

const SESSION = 'session-1'

type Row = { sessionId: string; itemId: string; body: AgentJournalItemBody }

function setup(holds = true) {
  const rows: Row[] = []
  const service = new AskUserService({
    holdsSession: () => holds,
    rows: {
      appendHostRow: async (sessionId: string, identity: AgentJournalItemIdentity, body) => {
        rows.push({ sessionId, itemId: agentJournalItemKey(identity), body })
      }
    }
  })
  return { rows, service }
}

/** What the wire hands a host-owned card: the answer in its packed option-id form. */
async function answerCard(
  service: AskUserService,
  row: Row,
  answers: { questionId: string; optionIds: string[]; other?: string }[]
) {
  const body = row.body
  if (body.kind !== 'question') {
    throw new Error('not a question')
  }
  const optionId = legacyAgentSessionSelectedOptionId(body, answers)
  const outcome = await service.hostOwnedPrompts.answer({
    sessionId: row.sessionId,
    itemId: row.itemId,
    optionId: optionId ?? encodeAgentSessionQuestionAnswers(answers)
  })
  if (outcome.ok) {
    outcome.afterCommit()
  }
  return outcome
}

const COLORS = { questions: [{ question: 'Which color?', options: ['Red', 'Green', 'Blue'] }] }

describe('AskUserService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('posts the card in the calling chat and returns the chosen option', async () => {
    const { rows, service } = setup()
    const asked = service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 60_000 })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    const [row] = rows
    expect(row!.sessionId).toBe(SESSION)
    expect(isHostOwnedPromptItemId(row!.itemId)).toBe(true)
    expect(row!.body).toMatchObject({ kind: 'question', question: 'Which color?' })

    expect(
      await answerCard(service, row!, [{ questionId: 'q1', optionIds: ['q1:choice-2'] }])
    ).toMatchObject({ ok: true })
    await expect(asked).resolves.toEqual({
      status: 'answered',
      questionItemId: row!.itemId,
      answers: [{ question: 'Which color?', selected: ['Green'] }],
      answer: 'Green'
    })
  })

  it('returns grouped and typed answers for several questions', async () => {
    const { rows, service } = setup()
    const asked = service.ask({
      sessionId: SESSION,
      questions: {
        questions: [
          { question: 'Colors?', options: ['Red', 'Blue'], multiSelect: true },
          { question: 'Name?', options: ['Ana'] }
        ]
      },
      timeoutMs: 60_000
    })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    await answerCard(service, rows[0]!, [
      { questionId: 'q1', optionIds: ['q1:choice-1', 'q1:choice-2'] },
      { questionId: 'q2', optionIds: [], other: 'Luz' }
    ])
    await expect(asked).resolves.toMatchObject({ status: 'answered', answer: 'Red, Blue\nLuz' })
  })

  it('does not deliver an answer whose journal write was rolled back', async () => {
    const { rows, service } = setup()
    const asked = service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 1_000 })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    const outcome = await service.hostOwnedPrompts.answer({
      sessionId: SESSION,
      itemId: rows[0]!.itemId,
      optionId: 'q1:choice-1'
    })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      outcome.rollback?.()
    }
    // Still waiting: the second answer is the one that lands.
    await answerCard(service, rows[0]!, [{ questionId: 'q1', optionIds: ['q1:choice-3'] }])
    await expect(asked).resolves.toMatchObject({ answer: 'Blue' })
  })

  it('reports a dismissed card as cancelled', async () => {
    const { rows, service } = setup()
    const asked = service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 60_000 })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    const outcome = await service.hostOwnedPrompts.cancel({
      sessionId: SESSION,
      itemId: rows[0]!.itemId
    })
    if (outcome.ok) {
      outcome.afterCommit()
    }
    await expect(asked).resolves.toEqual({ status: 'cancelled', questionItemId: rows[0]!.itemId })
    // The wire already records the dismissal; the service writes nothing more.
    expect(rows).toHaveLength(1)
  })

  it('withdraws the card when nobody answers in time', async () => {
    const { rows, service } = setup()
    const asked = service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 5_000 })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(asked).resolves.toMatchObject({ status: 'timedOut' })
    expect(rows).toHaveLength(2)
    expect(rows[1]!.itemId).toBe(rows[0]!.itemId)
    expect(rows[1]!.body).toMatchObject({ kind: 'question', resolution: { state: 'cancelled' } })
    expect(
      await service.hostOwnedPrompts.answer({
        sessionId: SESSION,
        itemId: rows[0]!.itemId,
        optionId: 'q1:choice-1'
      })
    ).toMatchObject({ ok: false, reason: 'promptGone' })
  })

  it('withdraws the card when the asking command goes away', async () => {
    const { rows, service } = setup()
    const abort = new AbortController()
    const asked = service.ask({
      sessionId: SESSION,
      questions: COLORS,
      timeoutMs: 60_000,
      signal: abort.signal
    })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    abort.abort()
    await expect(asked).resolves.toMatchObject({ status: 'timedOut' })
    expect(rows[1]!.body).toMatchObject({ resolution: { state: 'cancelled' } })
  })

  it('rejects an answer from another chat or to an option the card does not offer', async () => {
    const { rows, service } = setup()
    void service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 60_000 })
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    const itemId = rows[0]!.itemId
    expect(
      await service.hostOwnedPrompts.answer({ sessionId: 'other', itemId, optionId: 'q1:choice-1' })
    ).toMatchObject({ ok: false, reason: 'promptGone' })
    expect(
      await service.hostOwnedPrompts.answer({ sessionId: SESSION, itemId, optionId: 'nope' })
    ).toMatchObject({ ok: false, reason: 'optionRejected' })
  })

  it('refuses a chat this host does not hold, before posting anything', async () => {
    const { rows, service } = setup(false)
    await expect(
      service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 1_000 })
    ).rejects.toMatchObject({ code: 'ask_user_session_unavailable' })
    expect(rows).toHaveLength(0)
  })
})

describe('routeHostOwnedPrompts', () => {
  it('sends each host-owned card to the owner that raised it', async () => {
    const calls: string[] = []
    const owner = (name: string): StructuredAgentSessionHostOwnedPrompts => ({
      answer: async () => {
        calls.push(`${name}:answer`)
        return { ok: true, afterCommit: () => undefined }
      },
      cancel: async () => {
        calls.push(`${name}:cancel`)
        return { ok: true, afterCommit: () => undefined }
      }
    })
    const routed = routeHostOwnedPrompts({
      delegation: owner('delegation'),
      askUser: owner('askUser')
    })
    const { rows, service } = setup()
    void service.ask({ sessionId: SESSION, questions: COLORS, timeoutMs: 60_000 })
    vi.useRealTimers()
    await vi.waitFor(() => expect(rows).toHaveLength(1))
    await routed.answer({ sessionId: SESSION, itemId: rows[0]!.itemId, optionId: 'x' })
    await routed.cancel({ sessionId: SESSION, itemId: delegationQuestionItemId('d1') })
    expect(calls).toEqual(['askUser:answer', 'delegation:cancel'])
  })
})
