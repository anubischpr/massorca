import { describe, expect, it } from 'vitest'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { openBotTeamTaskCount } from './open-bot-team-task-count'

type Summary = Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>

describe('the open tasks the Conference room counts', () => {
  it('shows no count while a started task has no live status yet', () => {
    const statuses = new Map<string, Summary>([['s1', { status: 'idle' }]])

    expect(openBotTeamTaskCount([{ sessionId: 's1' }, { sessionId: 's2' }], statuses)).toBeNull()
  })

  it('counts every task that is not Done once each status has arrived', () => {
    const statuses = new Map<string, Summary>([
      ['finished', { status: 'idle' }],
      ['waiting', { status: 'attention' }]
    ])
    const tasks = [{ sessionId: 'finished' }, { sessionId: 'waiting' }, { sessionId: null }]

    expect(openBotTeamTaskCount(tasks, statuses)).toBe(2)
  })

  it('counts a task that was never started as open, with no status to wait for', () => {
    expect(openBotTeamTaskCount([{ sessionId: null }], new Map())).toBe(1)
  })

  it('is zero for a room whose tasks are all Done', () => {
    const statuses = new Map<string, Summary>([['finished', { status: 'idle' }]])

    expect(openBotTeamTaskCount([{ sessionId: 'finished' }], statuses)).toBe(0)
  })
})
