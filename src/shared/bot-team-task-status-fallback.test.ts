import { describe, expect, it } from 'vitest'
import type { AgentSessionStatusSummary } from './agent-session-wire'
import { botTeamTaskPlacement } from './bot-team-task-status-fallback'

function summary(
  status: 'working' | 'idle' | 'attention' | null,
  turnOutcome?: 'success' | 'failure' | 'cancellation' | 'interruption'
): AgentSessionStatusSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the placement reads only the status and the outcome.
  return {
    sessionId: 's',
    status,
    ...(turnOutcome ? { turnOutcome } : {})
  } as AgentSessionStatusSummary
}

describe('botTeamTaskPlacement', () => {
  it('places a task without a session in Todo, with the status Not started', () => {
    expect(
      botTeamTaskPlacement({ sessionId: null, live: undefined, kept: undefined, stored: undefined })
    ).toEqual({ status: 'Not started', placedAs: 'Not started' })
  })

  it('shows and places a live status as it is, ahead of anything stored or kept', () => {
    expect(
      botTeamTaskPlacement({
        sessionId: 's',
        live: summary('working'),
        kept: summary('idle', 'success'),
        stored: 'Done'
      })
    ).toEqual({ status: 'Working', placedAs: 'Working' })
  })

  it('shows Unknown, and places the task from its stored status, until the host answers', () => {
    expect(
      botTeamTaskPlacement({ sessionId: 's', live: undefined, kept: undefined, stored: 'Done' })
    ).toEqual({ status: 'Unknown', placedAs: 'Done' })
  })

  it('places a task that has no stored status from the summary this renderer kept', () => {
    expect(
      botTeamTaskPlacement({
        sessionId: 's',
        live: undefined,
        kept: summary('idle', 'success'),
        stored: null
      })
    ).toEqual({ status: 'Unknown', placedAs: 'Done' })
    expect(
      botTeamTaskPlacement({
        sessionId: 's',
        live: undefined,
        kept: summary('working'),
        stored: null
      })
    ).toEqual({ status: 'Unknown', placedAs: 'Working' })
  })

  it('prefers the stored status to the kept one', () => {
    expect(
      botTeamTaskPlacement({
        sessionId: 's',
        live: undefined,
        kept: summary('idle', 'failure'),
        stored: 'Done'
      }).placedAs
    ).toBe('Done')
  })

  it('places an unanswered task with nothing known in Todo, never In Progress', () => {
    expect(
      botTeamTaskPlacement({ sessionId: 's', live: undefined, kept: undefined, stored: null })
    ).toEqual({ status: 'Unknown', placedAs: 'Not started' })
    expect(
      botTeamTaskPlacement({
        sessionId: 's',
        live: summary(null),
        kept: summary(null),
        stored: undefined
      })
    ).toEqual({ status: 'Unknown', placedAs: 'Not started' })
  })
})
