import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetWorktreeSetupRunRegistryForTest,
  isWorktreeSetupRunPty,
  registerWorktreeSetupRun
} from './setup-run-registry'

afterEach(() => {
  _resetWorktreeSetupRunRegistryForTest()
})

describe('worktree setup run registry', () => {
  it('names only the PTYs registered as setup runs', () => {
    registerWorktreeSetupRun({ ptyId: 'pty-setup', worktreeId: 'wt-1', startedAt: 1 })

    expect(isWorktreeSetupRunPty('pty-setup')).toBe(true)
    expect(isWorktreeSetupRunPty('pty-agent')).toBe(false)
  })

  it('forgets every run on reset', () => {
    registerWorktreeSetupRun({ ptyId: 'pty-setup', worktreeId: 'wt-1', startedAt: 1 })

    _resetWorktreeSetupRunRegistryForTest()

    expect(isWorktreeSetupRunPty('pty-setup')).toBe(false)
  })
})
