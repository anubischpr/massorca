import { describe, expect, it } from 'vitest'
import type { AgentJournalItemBody } from './agent-session-journal-types'
import { delegatedChildrenFromJournal } from './delegated-children'
import type { DelegationNoticePayload } from './delegated-session-journal'

const started: DelegationNoticePayload = {
  requestId: 'req-1',
  title: 'Explore routing',
  status: 'started',
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  childSessionId: 'child-1',
  placement: 'current',
  automatic: true
}

function status(delegation: DelegationNoticePayload, observedAt: number) {
  const body: AgentJournalItemBody = { kind: 'status', text: 'notice', delegation }
  return { body, observedAt }
}

describe('delegatedChildrenFromJournal', () => {
  it('lists a started child as working, with its start time and session', () => {
    expect(delegatedChildrenFromJournal([status(started, 1_000)])).toEqual([
      {
        requestId: 'req-1',
        title: 'Explore routing',
        status: 'working',
        agent: 'codex',
        model: 'gpt-6.1-sol',
        effort: 'medium',
        automatic: true,
        childSessionId: 'child-1',
        startedAt: 1_000,
        resultSummary: null,
        durationMs: null,
        reason: null
      }
    ])
  })

  it('settles a started child on its finish and keeps the start session when the finish has none', () => {
    const finished: DelegationNoticePayload = {
      requestId: 'req-1',
      title: 'Explore routing',
      status: 'finished',
      outcome: 'succeeded',
      resultSummary: 'Two options.',
      childSessionId: null,
      durationMs: 90_000
    }
    const [child] = delegatedChildrenFromJournal([status(started, 1_000), status(finished, 9_000)])
    expect(child).toMatchObject({
      status: 'succeeded',
      childSessionId: 'child-1',
      startedAt: 1_000,
      resultSummary: 'Two options.',
      durationMs: 90_000
    })
  })

  it('marks a finish with a failed outcome as failed', () => {
    const finished: DelegationNoticePayload = {
      requestId: 'req-1',
      title: 'Explore routing',
      status: 'finished',
      outcome: 'failed',
      resultSummary: '',
      childSessionId: 'child-1',
      durationMs: null
    }
    const [child] = delegatedChildrenFromJournal([status(started, 1), status(finished, 2)])
    expect(child?.status).toBe('failed')
  })

  it('lists a request that never started as not started, with its reason and no session', () => {
    const failed: DelegationNoticePayload = {
      requestId: 'req-2',
      title: 'Lint sweep',
      status: 'failed',
      reason: 'every agent is at its usage limit'
    }
    expect(delegatedChildrenFromJournal([status(failed, 5)])).toEqual([
      expect.objectContaining({
        requestId: 'req-2',
        status: 'not-started',
        agent: null,
        childSessionId: null,
        startedAt: null,
        reason: 'every agent is at its usage limit'
      })
    ])
  })

  it('keeps one row per request in the order the requests first appear', () => {
    const second: DelegationNoticePayload = { ...started, requestId: 'req-2', title: 'Second' }
    const children = delegatedChildrenFromJournal([
      status(started, 1),
      status(second, 2),
      status(started, 3)
    ])
    expect(children.map((child) => child.requestId)).toEqual(['req-1', 'req-2'])
  })

  it('ignores status rows that carry no delegation payload', () => {
    const plainBody: AgentJournalItemBody = { kind: 'status', text: 'Hello' }
    expect(delegatedChildrenFromJournal([{ body: plainBody, observedAt: 1 }])).toEqual([])
  })
})
