import { describe, expect, it } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session-mutation-envelope'
import { structuredAgentSessionPayloadFingerprint } from '../../../shared/structured-agent-session-mutation'
import { promptPlan } from './structured-agent-session-mutation-plans'

const ANSWERS = [{ questionId: 'q1', optionIds: ['agent:pi'] }]

// A client hashes the fields it sent; the host refuses an answer whose plan hashes differently.
function clientFingerprint(extra: Record<string, unknown>): string {
  return structuredAgentSessionPayloadFingerprint({
    method: 'agentSession.respondTo:question',
    sessionId: 's',
    fields: { itemId: 'i', expectedRevision: 1, answers: ANSWERS, ...extra }
  })
}

function hostFingerprint(extra: { count?: number; designSystem?: 'use' | 'propose' | 'skip' }) {
  const plan = promptPlan({
    itemId: 'i',
    expectedRevision: 1,
    kind: 'question',
    answers: ANSWERS,
    ...extra
  })
  return computeAgentSessionPayloadFingerprint({
    method: plan.method,
    sessionId: 's',
    fields: plan.fields
  })
}

describe('promptPlan fingerprint', () => {
  it('matches a client answer that carries no prototype choice', () => {
    expect(hostFingerprint({})).toBe(clientFingerprint({}))
  })

  it('matches a client answer that carries the delegation card count', () => {
    expect(hostFingerprint({ count: 3 })).toBe(clientFingerprint({ count: 3 }))
  })

  it('matches a client answer that carries the count and the design system choice', () => {
    expect(hostFingerprint({ count: 3, designSystem: 'propose' })).toBe(
      clientFingerprint({ count: 3, designSystem: 'propose' })
    )
  })

  it('does not match a count the client did not send', () => {
    expect(hostFingerprint({ count: 3 })).not.toBe(clientFingerprint({}))
  })
})
