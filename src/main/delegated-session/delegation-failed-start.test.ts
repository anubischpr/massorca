import { describe, expect, it, vi } from 'vitest'
import { discardFailedDelegatedStart, type FailedStartCleanup } from './delegation-failed-start'

/** Records each step in the order it ran; a step named in `failing` rejects after it is recorded. */
function recordingCleanup(failing: { release?: boolean; removeWorktreeId?: string } = {}) {
  const steps: string[] = []
  const warn = vi.fn<FailedStartCleanup['warn']>()
  const cleanup: FailedStartCleanup = {
    releaseDispatch: async (dispatchId) => {
      steps.push(`release:${dispatchId}`)
      if (failing.release) {
        throw new Error('dispatch_not_found')
      }
    },
    removeWorktree: async (worktreeId) => {
      steps.push(`remove:${worktreeId}`)
      if (worktreeId === failing.removeWorktreeId) {
        throw new Error('worktree is locked')
      }
    },
    warn
  }
  return { cleanup, steps, warn }
}

describe('discardFailedDelegatedStart', () => {
  it('releases the failed Dispatch, then removes each worktree the start created', async () => {
    const { cleanup, steps, warn } = recordingCleanup()

    await discardFailedDelegatedStart(cleanup, {
      dispatchId: 'disp_1',
      createdWorktreeIds: ['wt_a', 'wt_b']
    })

    expect(steps).toEqual(['release:disp_1', 'remove:wt_a', 'remove:wt_b'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('removes the worktree of a start that filed no Dispatch without releasing anything', async () => {
    const { cleanup, steps } = recordingCleanup()

    await discardFailedDelegatedStart(cleanup, { dispatchId: null, createdWorktreeIds: ['wt_a'] })

    expect(steps).toEqual(['remove:wt_a'])
  })

  it('still removes the worktrees when releasing the Dispatch fails, and reports that failure', async () => {
    const { cleanup, steps, warn } = recordingCleanup({ release: true })

    await discardFailedDelegatedStart(cleanup, {
      dispatchId: 'disp_1',
      createdWorktreeIds: ['wt_a']
    })

    expect(steps).toEqual(['release:disp_1', 'remove:wt_a'])
    expect(warn).toHaveBeenCalledWith(
      'releasing the Dispatch of a failed child start failed',
      expect.any(Error)
    )
  })

  it('goes on past a worktree that will not be removed, and reports it', async () => {
    const { cleanup, steps, warn } = recordingCleanup({ removeWorktreeId: 'wt_a' })

    await expect(
      discardFailedDelegatedStart(cleanup, {
        dispatchId: null,
        createdWorktreeIds: ['wt_a', 'wt_b']
      })
    ).resolves.toBeUndefined()

    expect(steps).toEqual(['remove:wt_a', 'remove:wt_b'])
    expect(warn).toHaveBeenCalledWith(
      'removing the worktree of a failed child start failed',
      expect.any(Error)
    )
  })
})
