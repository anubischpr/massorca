import { describe, expect, it } from 'vitest'
import {
  AgentJournalItemBodySchema,
  isAdmissibleAgentJournalItemBody
} from './agent-session-journal-schemas'
import { agentJournalItemKey } from './agent-session-journal-item-key'
import type { AgentJournalItemBody } from './agent-session-journal-types'
import type { DelegationAgentUsage, DelegationDecision } from './delegated-session-types'
import {
  delegationAgentOptionId,
  delegationNoticeRowIdentity,
  delegationQuestionItemId,
  delegationQuestionRowIdentity,
  delegationRequestIdOfQuestionItem,
  isHostOwnedDelegationQuestion,
  parseDelegationOptionId,
  readDelegationCardPayload,
  readDelegationDecision,
  readDelegationNoticePayload,
  type DelegationCardPayload
} from './delegated-session-journal'

const PENDING = { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }

const USAGE: DelegationAgentUsage = {
  agent: 'codex',
  bindingPercent: 34,
  window: 'session',
  noData: false,
  excluded: null
}

const DECISION: DelegationDecision = {
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  tier: 3,
  dimensions: { risk: 'low', complexity: 'medium', verifiability: 'high', ambiguity: 'low' },
  placement: 'new-child',
  placementWarning: null,
  ranking: [USAGE],
  reasons: ['lowest-usage']
}

// As a newer host may publish it: a reason code this build has no name for.
const DECISION_FROM_NEWER_HOST = {
  ...DECISION,
  reasons: ['lowest-usage', 'a-reason-from-a-newer-host']
}

const CARD: DelegationCardPayload = {
  requestId: 'deleg_aaaaaaaaaaaa',
  title: 'Retry helper',
  decision: DECISION,
  agents: [
    { agent: 'codex', label: 'Codex', usage: USAGE, model: 'gpt-6.1-sol', effort: 'medium' }
  ],
  placement: 'new-child',
  placementWarning: null
}

describe('delegation row keys', () => {
  it('derives the request from the card key and from nothing else', () => {
    const itemId = delegationQuestionItemId('deleg_aaaaaaaaaaaa')

    expect(delegationRequestIdOfQuestionItem(itemId)).toBe('deleg_aaaaaaaaaaaa')
    expect(
      delegationRequestIdOfQuestionItem(
        agentJournalItemKey({ provider: 'orca', clientMessageId: 'claude-prompt:s:p' })
      )
    ).toBeNull()
    expect(
      delegationRequestIdOfQuestionItem(
        agentJournalItemKey(delegationNoticeRowIdentity('deleg_aaaaaaaaaaaa', 'started'))
      )
    ).toBeNull()
    expect(delegationRequestIdOfQuestionItem('not a key')).toBeNull()
    expect(delegationQuestionRowIdentity('deleg_aaaaaaaaaaaa')).toEqual({
      provider: 'orca',
      clientMessageId: 'delegation:deleg_aaaaaaaaaaaa'
    })
  })

  it('keeps one notice row per request and status', () => {
    expect(delegationNoticeRowIdentity('deleg_a', 'finished')).not.toEqual(
      delegationNoticeRowIdentity('deleg_a', 'started')
    )
  })

  it('parses the option ids the card offers', () => {
    expect(parseDelegationOptionId('automatic')).toEqual({ kind: 'automatic' })
    expect(parseDelegationOptionId(delegationAgentOptionId('codex'))).toEqual({
      kind: 'agent',
      agent: 'codex'
    })
    expect(parseDelegationOptionId('agent:')).toBeNull()
    expect(parseDelegationOptionId('allow')).toBeNull()
  })
})

describe('the delegation field on a journal body', () => {
  const question = {
    kind: 'question' as const,
    question: 'Which agent should handle this session?',
    options: [{ id: 'automatic', label: 'Automatic' }],
    resolution: { ...PENDING, state: 'pending' as const }
  }

  it('is optional: a provider question without it is unchanged and not host-owned', () => {
    expect(isAdmissibleAgentJournalItemBody(question)).toBe(true)
    expect(isHostOwnedDelegationQuestion(question)).toBe(false)
  })

  it('marks a question the host owns, and admits it with the payload kept whole', () => {
    const owned: AgentJournalItemBody = { ...question, delegation: CARD }

    expect(isAdmissibleAgentJournalItemBody(owned)).toBe(true)
    expect(isHostOwnedDelegationQuestion(owned)).toBe(true)
    const parsed = AgentJournalItemBodySchema.safeParse(owned)
    expect(parsed.success && 'delegation' in parsed.data && parsed.data.delegation).toEqual(CARD)
  })

  it('admits a status notice carrying one and rejects a payload with no request', () => {
    const status = { kind: 'status', text: 'Started', delegation: { requestId: 'deleg_a' } }

    expect(isAdmissibleAgentJournalItemBody(status)).toBe(true)
    expect(isAdmissibleAgentJournalItemBody({ ...status, delegation: { title: 'x' } })).toBe(false)
  })
})

describe('reading a delegation payload', () => {
  it('reads the card and drops a reason code this build does not know', () => {
    const read = readDelegationCardPayload({ ...CARD, decision: DECISION_FROM_NEWER_HOST })

    expect(read?.decision?.reasons).toEqual(['lowest-usage'])
    expect(read?.agents[0]?.label).toBe('Codex')
  })

  it('keeps the card when only its decision is unreadable', () => {
    expect(readDelegationCardPayload({ ...CARD, decision: { agent: 5 } })?.decision).toBeNull()
  })

  it('reads nothing from a card missing its agents', () => {
    expect(readDelegationCardPayload({ ...CARD, agents: undefined })).toBeNull()
    expect(readDelegationCardPayload('card')).toBeNull()
    expect(readDelegationDecision(null)).toBeNull()
  })

  it('reads each notice status and nothing else', () => {
    const base = { requestId: 'deleg_a', title: 'Retry helper' }
    expect(
      readDelegationNoticePayload({
        ...base,
        status: 'started',
        agent: 'codex',
        model: 'gpt-6.1-sol',
        effort: null,
        childSessionId: 'session_child_1',
        placement: 'current'
      })
    ).toMatchObject({ status: 'started', automatic: false, effort: null })
    expect(
      readDelegationNoticePayload({ ...base, status: 'failed', reason: 'No headroom' })
    ).toEqual({ ...base, status: 'failed', reason: 'No headroom' })
    expect(
      readDelegationNoticePayload({
        ...base,
        status: 'finished',
        outcome: 'succeeded',
        resultSummary: 'Done'
      })
    ).toMatchObject({ childSessionId: null, durationMs: null })
    expect(
      readDelegationNoticePayload({ ...base, status: 'finished', outcome: 'maybe' })
    ).toBeNull()
    expect(readDelegationNoticePayload({ ...base, status: 'paused' })).toBeNull()
  })
})
