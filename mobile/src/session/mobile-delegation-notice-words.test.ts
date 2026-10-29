import { describe, expect, it } from 'vitest'
import type {
  DelegationFailedPayload,
  DelegationFinishedPayload,
  DelegationStartedPayload
} from '../../../src/shared/delegated-session-journal'
import {
  delegationFailedText,
  delegationFinishedHeading,
  delegationFinishedMeta,
  delegationStartedText,
  durationText
} from './mobile-delegation-notice-words'

const started: DelegationStartedPayload = {
  requestId: 'request-1',
  title: 'Explore Gentle Shell v5',
  status: 'started',
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  childSessionId: 'child-1',
  placement: 'current',
  automatic: true
}

const finished: DelegationFinishedPayload = {
  requestId: 'request-1',
  title: 'Explore Gentle Shell v5',
  status: 'finished',
  outcome: 'succeeded',
  resultSummary: 'The features worth adopting.',
  childSessionId: 'child-1',
  durationMs: 12 * 60_000
}

describe('delegation notice copy', () => {
  it('names the agent, model and effort, and says when Automatic chose them', () => {
    expect(delegationStartedText(started)).toBe(
      'Started child session “Explore Gentle Shell v5” with Codex · gpt-6.1-sol · medium (Automatic)'
    )
    expect(delegationStartedText({ ...started, automatic: false, model: null, effort: null })).toBe(
      'Started child session “Explore Gentle Shell v5” with Codex · default model'
    )
  })

  it('falls back to the agent id when the catalog does not list it', () => {
    expect(delegationStartedText({ ...started, agent: 'future-agent', automatic: false })).toBe(
      'Started child session “Explore Gentle Shell v5” with future-agent · gpt-6.1-sol · medium'
    )
  })

  it('says why a child did not start', () => {
    const failed: DelegationFailedPayload = {
      requestId: 'request-1',
      title: 'Explore Gentle Shell v5',
      status: 'failed',
      reason: 'the agent is not connected'
    }
    expect(delegationFailedText(failed)).toBe(
      'Child session “Explore Gentle Shell v5” did not start: the agent is not connected'
    )
  })

  it('heads and meters the finished notice by its outcome', () => {
    expect(delegationFinishedHeading(finished)).toBe('Child session finished')
    expect(delegationFinishedHeading({ ...finished, outcome: 'failed' })).toBe(
      'Child session failed'
    )
    expect(delegationFinishedMeta(finished)).toBe('12 min · succeeded')
    expect(delegationFinishedMeta({ ...finished, outcome: 'failed', durationMs: null })).toBe(
      'failed'
    )
  })
})

describe('durationText', () => {
  it('words the duration in whole minutes, as the chat does', () => {
    expect(durationText(null)).toBeNull()
    expect(durationText(0)).toBe('under 1 min')
    expect(durationText(59_999)).toBe('under 1 min')
    expect(durationText(60_000)).toBe('1 min')
    expect(durationText(59 * 60_000)).toBe('59 min')
    expect(durationText(65 * 60_000)).toBe('1 h 5 min')
  })
})
