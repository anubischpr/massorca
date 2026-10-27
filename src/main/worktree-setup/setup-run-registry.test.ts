import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetWorktreeSetupRunRegistryForTest,
  bindWorktreeSetupRunsToSession,
  isWorktreeSetupRunPty,
  onWorktreeSetupRunsChanged,
  registerWorktreeSetupRun,
  setWorktreeSetupRunStopper,
  settleWorktreeSetupRunPty,
  stopWorktreeSetupRunForSession,
  worktreeSetupRunsForSession,
  worktreeSetupRunWorktreeId
} from './setup-run-registry'

function registerRun(ptyId = 'pty-setup'): void {
  registerWorktreeSetupRun({ ptyId, worktreeId: 'wt-1', startedAt: 1 })
  bindWorktreeSetupRunsToSession({ worktreeId: 'wt-1', sessionId: 'session-1' })
}

afterEach(() => {
  _resetWorktreeSetupRunRegistryForTest()
})

describe('worktree setup run registry', () => {
  it('names only the PTYs registered as setup runs', () => {
    registerWorktreeSetupRun({ ptyId: 'pty-setup', worktreeId: 'wt-1', startedAt: 1 })

    expect(isWorktreeSetupRunPty('pty-setup')).toBe(true)
    expect(isWorktreeSetupRunPty('pty-agent')).toBe(false)
  })

  it('settles a run by its exit: completed on zero, failed otherwise', () => {
    registerRun('pty-ok')
    registerRun('pty-bad')

    settleWorktreeSetupRunPty('pty-ok', 0, 10)
    settleWorktreeSetupRunPty('pty-bad', 3, 11)

    const runs = worktreeSetupRunsForSession('session-1')
    expect(runs.find((run) => run.ptyId === 'pty-ok')).toMatchObject({
      state: 'completed',
      exitCode: 0,
      settledAt: 10
    })
    expect(runs.find((run) => run.ptyId === 'pty-bad')).toMatchObject({
      state: 'failed',
      exitCode: 3
    })
  })

  it('keeps the first settle and ignores a later exit for the same run', () => {
    registerRun()
    settleWorktreeSetupRunPty('pty-setup', 0, 10)

    settleWorktreeSetupRunPty('pty-setup', 9, 20)

    expect(worktreeSetupRunsForSession('session-1')[0]).toMatchObject({
      state: 'completed',
      exitCode: 0
    })
  })

  it('shows a run only in the chat its worktree is bound to', () => {
    registerRun()

    expect(worktreeSetupRunsForSession('session-1')).toHaveLength(1)
    expect(worktreeSetupRunsForSession('session-other')).toHaveLength(0)
  })

  it('stops a running run named by its row for its own chat, killing its PTY', async () => {
    registerRun()
    const stop = vi.fn(async () => ({ ok: true }))
    setWorktreeSetupRunStopper(stop)

    const stopped = await stopWorktreeSetupRunForSession({
      taskId: 'worktree-setup:pty-setup',
      sessionId: 'session-1'
    })

    expect(stopped).toBe(true)
    expect(stop).toHaveBeenCalledWith('pty-setup')
  })

  it('does not stop a run for another chat, an unknown id, or a settled run', async () => {
    registerRun()
    const stop = vi.fn(async () => ({ ok: true }))
    setWorktreeSetupRunStopper(stop)

    expect(
      await stopWorktreeSetupRunForSession({
        taskId: 'worktree-setup:pty-setup',
        sessionId: 'session-other'
      })
    ).toBe(false)
    expect(
      await stopWorktreeSetupRunForSession({ taskId: 'agent-task-1', sessionId: 'session-1' })
    ).toBe(false)
    expect(
      await stopWorktreeSetupRunForSession({ taskId: undefined, sessionId: 'session-1' })
    ).toBe(false)
    settleWorktreeSetupRunPty('pty-setup', 0, 10)
    expect(
      await stopWorktreeSetupRunForSession({
        taskId: 'worktree-setup:pty-setup',
        sessionId: 'session-1'
      })
    ).toBe(false)
    expect(stop).not.toHaveBeenCalled()
  })

  it('reports a failed stop as not stopped and leaves the run unmarked for a retry', async () => {
    registerRun()
    setWorktreeSetupRunStopper(async () => {
      throw new Error('kill refused')
    })

    expect(
      await stopWorktreeSetupRunForSession({
        taskId: 'worktree-setup:pty-setup',
        sessionId: 'session-1'
      })
    ).toBe(false)
    // Why: a refused kill must not read as a user stop when the PTY later exits on its own.
    settleWorktreeSetupRunPty('pty-setup', 0, 10)
    expect(worktreeSetupRunsForSession('session-1')[0]).toMatchObject({ state: 'completed' })
  })

  it('settles a user-stopped run as stopped, whatever code the kill left', async () => {
    registerRun()
    let finishKill: () => void = () => {}
    setWorktreeSetupRunStopper(
      () =>
        new Promise<void>((resolve) => {
          finishKill = resolve
        })
    )
    const stopping = stopWorktreeSetupRunForSession({
      taskId: 'worktree-setup:pty-setup',
      sessionId: 'session-1'
    })
    finishKill()
    await stopping

    settleWorktreeSetupRunPty('pty-setup', -1, 10)

    expect(worktreeSetupRunsForSession('session-1')[0]).toMatchObject({ state: 'stopped' })
  })

  it('notifies listeners when a run settles or is bound to a chat', () => {
    const listener = vi.fn()
    onWorktreeSetupRunsChanged(listener)
    registerRun()
    expect(listener).toHaveBeenLastCalledWith('wt-1')

    listener.mockClear()
    settleWorktreeSetupRunPty('pty-setup', 0, 10)
    expect(listener).toHaveBeenCalledWith('wt-1')
  })

  it('names the workspace of a setup run, and nothing for another PTY', () => {
    registerRun('pty-setup')

    expect(worktreeSetupRunWorktreeId('pty-setup')).toBe('wt-1')
    expect(worktreeSetupRunWorktreeId('pty-agent')).toBeNull()
  })
})
