import { describe, expect, it } from 'vitest'
import {
  agentSessionBackgroundTasksEqual,
  type AgentSessionBackgroundTask
} from './agent-session-background-task-wire'

const agentRow: AgentSessionBackgroundTask = {
  id: 'task-1',
  kind: 'agent',
  description: 'Explore',
  state: 'working',
  startedAt: 100,
  stoppable: true
}

describe('agentSessionBackgroundTasksEqual origin', () => {
  it('treats a row with no origin and one with origin undefined as equal', () => {
    expect(agentSessionBackgroundTasksEqual([agentRow], [{ ...agentRow, origin: undefined }])).toBe(
      true
    )
  })

  it('sees an exit code change so a settled setup row that finishes differently is not dropped', () => {
    const settled: AgentSessionBackgroundTask = { ...agentRow, origin: 'orca', state: 'done' }
    expect(agentSessionBackgroundTasksEqual([settled], [{ ...settled, exitCode: 0 }])).toBe(false)
    expect(
      agentSessionBackgroundTasksEqual([{ ...settled, exitCode: 0 }], [{ ...settled, exitCode: 0 }])
    ).toBe(true)
  })

  it('sees an origin change so a publish that only adds or removes the marker is not dropped', () => {
    const orca: AgentSessionBackgroundTask = { ...agentRow, kind: 'command', origin: 'orca' }
    expect(agentSessionBackgroundTasksEqual([agentRow], [orca])).toBe(false)
    expect(agentSessionBackgroundTasksEqual([orca], [{ ...orca, origin: undefined }])).toBe(false)
    expect(agentSessionBackgroundTasksEqual([orca], [{ ...orca }])).toBe(true)
  })
})

describe('background task wire back-compat', () => {
  it('reads a row from an older host unchanged and keeps origin on an Orca row', () => {
    // Why: an older host or client only ever sends the fields it knows; JSON must round-trip both shapes.
    const olderRow: AgentSessionBackgroundTask = JSON.parse(JSON.stringify(agentRow))
    expect(olderRow).toEqual(agentRow)
    expect(olderRow.origin).toBeUndefined()

    const orca: AgentSessionBackgroundTask = {
      id: 'worktree-setup:42',
      kind: 'command',
      description: 'Worktree setup',
      state: 'done',
      startedAt: 200,
      stoppable: false,
      origin: 'orca'
    }
    const parsed: AgentSessionBackgroundTask = JSON.parse(JSON.stringify(orca))
    expect(parsed).toEqual(orca)
    expect(parsed.origin).toBe('orca')
  })
})
