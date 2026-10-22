import { describe, expect, it } from 'vitest'
import { isAgentSessionRefusalError } from '../../../shared/agent-session-wire-refusals'
import { unprovenStopAsRefusal } from './structured-agent-session-conversation-lifetime'
import { StructuredAgentSessionEvictionError } from './structured-agent-session-eviction'

const UNPROVEN = new StructuredAgentSessionEvictionError(
  'stop-provider-child',
  'session-1',
  new Error('provider child exit was not proven')
)

describe('unprovenStopAsRefusal', () => {
  it('answers a person close that could not prove the agent exited with the typed refusal', () => {
    const answer = unprovenStopAsRefusal('user-close', UNPROVEN)
    expect(isAgentSessionRefusalError(answer)).toBe(true)
    if (!isAgentSessionRefusalError(answer)) {
      return
    }
    expect(answer.refusal.code).toBe('agent_session_ownership_unknown')
    expect(answer.refusal.details).toEqual({
      reason: 'previousExitUnverifiable',
      ownerVerdict: 'unverifiable'
    })
  })

  it('passes other causes, other eviction steps and other errors through unchanged', () => {
    const otherStep = new StructuredAgentSessionEvictionError(
      'close-sink',
      'session-1',
      new Error('sink failed')
    )
    const other = new Error('boom')
    expect(unprovenStopAsRefusal('evict', UNPROVEN)).toBe(UNPROVEN)
    expect(unprovenStopAsRefusal('user-close', otherStep)).toBe(otherStep)
    expect(unprovenStopAsRefusal('user-close', other)).toBe(other)
  })
})
