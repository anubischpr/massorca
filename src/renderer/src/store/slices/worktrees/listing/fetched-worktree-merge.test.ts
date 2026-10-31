import { describe, expect, it } from 'vitest'
import { makeWorktree } from '../../worktrees-slice-test-fixtures'
import { preserveConcurrentUserRowFields } from './fetched-worktree-merge'

const matchesEveryHost = (): boolean => true

describe('preserveConcurrentUserRowFields', () => {
  it('keeps a row name saved while the refresh was in flight', () => {
    const started = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1' })]
    const current = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Billing fix' })
    ]
    const incoming = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1' })]

    const [merged] = preserveConcurrentUserRowFields(incoming, started, current, matchesEveryHost)

    expect(merged.manualDisplayName).toBe('Billing fix')
  })

  it('keeps a row name cleared while the refresh was in flight', () => {
    const started = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Billing fix' })
    ]
    const current = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: null })]
    const incoming = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Billing fix' })
    ]

    const [merged] = preserveConcurrentUserRowFields(incoming, started, current, matchesEveryHost)

    expect(merged.manualDisplayName).toBeNull()
  })

  it('takes the response row name when this client did not change it', () => {
    const started = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Old name' })
    ]
    const current = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Old name' })
    ]
    const incoming = [
      makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualDisplayName: 'Set elsewhere' })
    ]

    const [merged] = preserveConcurrentUserRowFields(incoming, started, current, matchesEveryHost)

    expect(merged.manualDisplayName).toBe('Set elsewhere')
  })

  it('still keeps a manual order changed while the refresh was in flight', () => {
    const started = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualOrder: 1 })]
    const current = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualOrder: 5 })]
    const incoming = [makeWorktree({ id: 'repo-1::/a', repoId: 'repo-1', manualOrder: 1 })]

    const [merged] = preserveConcurrentUserRowFields(incoming, started, current, matchesEveryHost)

    expect(merged.manualOrder).toBe(5)
  })
})
