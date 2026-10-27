import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetWorktreeSetupRunRegistryForTest,
  bindWorktreeSetupRunsToSession,
  registerWorktreeSetupRun,
  setWorktreeSetupRunStopper,
  settleWorktreeSetupRunPty,
  stopWorktreeSetupRunForSession
} from './setup-run-registry'
import { worktreeSetupRunRoster } from './setup-run-roster'

afterEach(() => {
  _resetWorktreeSetupRunRegistryForTest()
})

function bound(ptyId: string): void {
  registerWorktreeSetupRun({ ptyId, worktreeId: 'wt-1', startedAt: 100 })
  bindWorktreeSetupRunsToSession({ worktreeId: 'wt-1', sessionId: 'session-1' })
}

describe('worktreeSetupRunRoster', () => {
  it('publishes a running run as a live stoppable Orca command row', () => {
    bound('pty-1')

    expect(worktreeSetupRunRoster('session-1')).toEqual({
      tasks: [
        {
          id: 'worktree-setup:pty-1',
          kind: 'command',
          description: 'Worktree setup',
          state: 'working',
          startedAt: 100,
          stoppable: true,
          origin: 'orca'
        }
      ],
      settledTasks: []
    })
  })

  it('moves a finished run to settled rows with its exit code', () => {
    bound('pty-1')
    settleWorktreeSetupRunPty('pty-1', 1, 150)

    expect(worktreeSetupRunRoster('session-1')).toEqual({
      tasks: [],
      settledTasks: [
        {
          id: 'worktree-setup:pty-1',
          kind: 'command',
          description: 'Worktree setup',
          state: 'done',
          startedAt: 100,
          stoppable: false,
          origin: 'orca',
          exitCode: 1
        }
      ]
    })
  })

  it('omits the exit code of a run the user stopped', async () => {
    bound('pty-1')
    setWorktreeSetupRunStopper(async () => undefined)
    await stopWorktreeSetupRunForSession({ taskId: 'worktree-setup:pty-1', sessionId: 'session-1' })
    settleWorktreeSetupRunPty('pty-1', -1, 150)

    const [row] = worktreeSetupRunRoster('session-1').settledTasks
    expect(row).toMatchObject({ state: 'done', origin: 'orca' })
    expect(row).not.toHaveProperty('exitCode')
  })

  it('is empty for a chat with no bound run', () => {
    expect(worktreeSetupRunRoster('session-1')).toEqual({ tasks: [], settledTasks: [] })
  })
})
