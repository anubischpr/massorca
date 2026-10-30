import { describe, expect, it, vi } from 'vitest'
import {
  branchLeafOf,
  isUserSetDisplayName,
  nameDelegatedChildWorktree,
  type DelegatedChildWorktreeNameDeps
} from './delegated-child-worktree-name'

const WORKTREE_ID = 'repo-1::/repo/slug'
const BRANCH = 'refs/heads/anubischpr/fix-retry-a1b2c3'

function deps(overrides: Partial<DelegatedChildWorktreeNameDeps> = {}) {
  return {
    isDelegatedChild: () => true,
    // A child is created with its slug as a pinned name, equal to the branch leaf.
    getMeta: () => ({ displayName: 'fix-retry-a1b2c3', displayNameIsPinned: true }),
    resolveBranch: async () => BRANCH,
    renameWorktree: vi.fn<(worktreeId: string, displayName: string) => void>(),
    ...overrides
  }
}

describe('nameDelegatedChildWorktree', () => {
  it('titles a delegated child whose name is still its creation slug', async () => {
    const d = deps()
    expect(await nameDelegatedChildWorktree(WORKTREE_ID, 'Repair retry', d)).toBe(true)
    expect(d.renameWorktree).toHaveBeenCalledWith(WORKTREE_ID, 'Repair retry')
  })

  it('keeps a name the user chose', async () => {
    const d = deps({
      getMeta: () => ({ displayName: 'Mi tarea', displayNameIsPinned: true })
    })
    expect(await nameDelegatedChildWorktree(WORKTREE_ID, 'Repair retry', d)).toBe(false)
    expect(d.renameWorktree).not.toHaveBeenCalled()
  })

  it('leaves a worktree no dispatch created as a child alone', async () => {
    const d = deps({ isDelegatedChild: () => false })
    expect(await nameDelegatedChildWorktree(WORKTREE_ID, 'Repair retry', d)).toBe(false)
    expect(d.renameWorktree).not.toHaveBeenCalled()
  })

  it('declines an empty conversation name', async () => {
    const d = deps()
    expect(await nameDelegatedChildWorktree(WORKTREE_ID, '   ', d)).toBe(false)
    expect(d.renameWorktree).not.toHaveBeenCalled()
  })
})

describe('isUserSetDisplayName', () => {
  it('treats a pinned name equal to the branch leaf as automatic', () => {
    expect(
      isUserSetDisplayName(
        { displayName: 'fix-retry-a1b2c3', displayNameIsPinned: true },
        'fix-retry-a1b2c3'
      )
    ).toBe(false)
  })

  it('treats an explicitly unpinned name as automatic', () => {
    expect(
      isUserSetDisplayName(
        { displayName: 'Mi tarea', displayNameIsPinned: false },
        'fix-retry-a1b2c3'
      )
    ).toBe(false)
  })

  it('treats a pinned name that differs from the branch leaf as user-set', () => {
    expect(
      isUserSetDisplayName(
        { displayName: 'Mi tarea', displayNameIsPinned: true },
        'fix-retry-a1b2c3'
      )
    ).toBe(true)
  })

  it('treats a missing record as not user-set', () => {
    expect(isUserSetDisplayName(undefined, 'fix-retry-a1b2c3')).toBe(false)
  })
})

describe('branchLeafOf', () => {
  it('returns the last segment of a prefixed branch', () => {
    expect(branchLeafOf(BRANCH)).toBe('fix-retry-a1b2c3')
    expect(branchLeafOf('plain-branch')).toBe('plain-branch')
  })
})
