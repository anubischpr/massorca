import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { WorktreeCardEnvironmentSection } from './WorktreeCardEnvironmentSection'

const account = vi.hoisted((): { label: string | null } => ({ label: 'octocat' }))

vi.mock('@/components/repo/use-repo-gh-account-display', () => ({
  useRepoGhAccountDisplay: () => ({ label: account.label, mismatch: false })
}))

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
const worktree = {
  id: 'wt-1',
  displayName: 'Fix login',
  path: '/work/orca-fix-login'
} as unknown as Worktree
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
const repo = { id: 'r1', displayName: 'orca' } as unknown as Repo

describe('WorktreeCardEnvironmentSection', () => {
  it('lists worktree, host, account and path under an Environment heading', () => {
    account.label = 'octocat'
    const markup = renderToStaticMarkup(
      <WorktreeCardEnvironmentSection worktree={worktree} repo={repo} host="gpu-box" />
    )

    expect(markup).toContain('Environment')
    expect(markup).toContain('Fix login')
    expect(markup).toContain('gpu-box')
    expect(markup).toContain('octocat')
    expect(markup).toContain('/work/orca-fix-login')
  })

  it('says when no account is bound instead of leaving the field blank', () => {
    account.label = null
    const markup = renderToStaticMarkup(
      <WorktreeCardEnvironmentSection worktree={worktree} repo={repo} host="This computer" />
    )

    expect(markup).toContain('No account bound')
  })
})
