import { describe, expect, it } from 'vitest'
import { botTeamTaskStatus } from './bot-team-task-status'

describe('botTeamTaskStatus', () => {
  it('says Not started before the task has a session', () => {
    expect(botTeamTaskStatus(null, undefined)).toBe('Not started')
  })

  it('says Unknown until the host answers for the session, never Working', () => {
    expect(botTeamTaskStatus('s', undefined)).toBe('Unknown')
    expect(botTeamTaskStatus('s', { status: null })).toBe('Unknown')
  })

  it('follows the live status', () => {
    expect(botTeamTaskStatus('s', { status: 'working' })).toBe('Working')
    expect(botTeamTaskStatus('s', { status: 'attention' })).toBe('Waiting for you')
    expect(botTeamTaskStatus('s', { status: 'idle' })).toBe('Done')
  })

  it('says Stopped when the turn was interrupted, not Done', () => {
    expect(botTeamTaskStatus('s', { status: 'idle', turnOutcome: 'interruption' })).toBe('Stopped')
    expect(botTeamTaskStatus('s', { status: 'idle', turnOutcome: 'cancellation' })).toBe('Stopped')
  })

  it('says Stuck when the turn failed', () => {
    expect(botTeamTaskStatus('s', { status: 'idle', turnOutcome: 'failure' })).toBe('Stuck')
  })
})
