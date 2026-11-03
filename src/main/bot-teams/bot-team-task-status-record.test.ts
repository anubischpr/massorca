import { describe, expect, it } from 'vitest'
import type {
  AgentSessionStatusEvent,
  AgentSessionStatusSummary
} from '../../shared/agent-session-wire'
import { watchBotTeamTaskLastStatus } from './bot-team-task-status-record'

function summary(
  sessionId: string,
  status: 'working' | 'idle' | 'attention' | null,
  turnOutcome?: 'success' | 'failure' | 'cancellation' | 'interruption'
): AgentSessionStatusSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the watcher reads only the id, the status and the outcome.
  return { sessionId, status, ...(turnOutcome ? { turnOutcome } : {}) } as AgentSessionStatusSummary
}

function feed(onStatus?: (sessionId: string, status: string | null) => void) {
  let emit: (event: AgentSessionStatusEvent) => void = () => {}
  const kept: [string, string | null][] = []
  const stop = watchBotTeamTaskLastStatus(
    {
      subscribeStatus: (subscriber) => {
        emit = subscriber.emit
        return () => {}
      }
    },
    (sessionId, status) => {
      kept.push([sessionId, status])
      onStatus?.(sessionId, status)
    }
  )
  return {
    kept,
    stop,
    snapshot: (...sessions: AgentSessionStatusSummary[]) => emit({ type: 'snapshot', sessions }),
    status: (session: AgentSessionStatusSummary) => emit({ type: 'status', session })
  }
}

describe('keeping a task status on the host', () => {
  it('keeps the terminal status of a session that finishes, stops or gets stuck', () => {
    const events = feed()

    events.status(summary('done', 'idle'))
    events.status(summary('stopped', 'idle', 'cancellation'))
    events.status(summary('stuck', 'idle', 'failure'))

    expect(events.kept).toEqual([
      ['done', 'Done'],
      ['stopped', 'Stopped'],
      ['stuck', 'Stuck']
    ])
  })

  it('clears the kept status while the session works or waits for the person', () => {
    const events = feed()

    events.status(summary('a', 'working'))
    events.status(summary('a', 'attention'))

    expect(events.kept).toEqual([
      ['a', null],
      ['a', null]
    ])
  })

  it('keeps nothing for a session the host has not answered for yet', () => {
    const events = feed()

    events.status(summary('a', null))
    events.snapshot(summary('b', null))

    expect(events.kept).toEqual([])
  })

  it('keeps the status of sessions already finished or working in the opening snapshot', () => {
    const events = feed()

    events.snapshot(summary('a', 'idle', 'failure'), summary('b', 'working'))

    expect(events.kept).toEqual([
      ['a', 'Stuck'],
      ['b', null]
    ])
  })

  it('does not break the status feed when keeping a status fails', () => {
    const events = feed(() => {
      throw new Error('database is closed')
    })

    expect(() => events.status(summary('a', 'idle'))).not.toThrow()
  })
})
