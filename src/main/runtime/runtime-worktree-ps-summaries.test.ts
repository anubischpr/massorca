import { describe, expect, it } from 'vitest'
import { buildRuntimeWorktreePsSummaries } from './runtime-worktree-ps-summaries'
import type { ResolvedWorktree } from './runtime-worktree-path-identity'
import type { RuntimeStore } from './runtime-store-contract'

describe('buildRuntimeWorktreePsSummaries', () => {
  it('preserves persisted host ownership over the resolved row fallback', () => {
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      hostId: 'ssh:resolved-host',
      path: '/workspace/app',
      branch: 'feature',
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0
    } as unknown as ResolvedWorktree
    const store = {
      getRepos: () => [],
      getWorktreeMeta: () => ({ hostId: 'ssh:persisted-host' }),
      getAllWorktreeMeta: () => ({}),
      getFolderWorkspaces: () => [],
      getProjectGroups: () => []
    } as unknown as RuntimeStore

    const summary = buildRuntimeWorktreePsSummaries({
      store,
      resolvedWorktrees: [worktree],
      platformByRepoId: new Map()
    }).get(worktree.id)

    expect(summary?.hostId).toBe('ssh:persisted-host')
  })

  it('carries the error of a failed delete the host still lists', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only these fields for a git row.
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      path: '/workspace/app',
      branch: 'feature',
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0,
      removalError: 'Operation not permitted'
    } as unknown as ResolvedWorktree
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only these store members.
    const store = {
      getRepos: () => [],
      getWorktreeMeta: () => undefined,
      getAllWorktreeMeta: () => ({}),
      getFolderWorkspaces: () => [],
      getProjectGroups: () => []
    } as unknown as RuntimeStore

    const summary = buildRuntimeWorktreePsSummaries({
      store,
      resolvedWorktrees: [worktree],
      platformByRepoId: new Map()
    }).get(worktree.id)

    expect(summary?.removalError).toBe('Operation not permitted')
  })

  it('sends the commit of a detached HEAD and no branch prefix', () => {
    const head = 'a'.repeat(40)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only these fields for a git row.
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      path: '/workspace/app',
      branch: '',
      git: { path: '/workspace/app', head, branch: '', isBare: false },
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0
    } as unknown as ResolvedWorktree
    const store = {
      getRepos: () => [{ id: 'repo-1', displayName: 'app', gitUsername: 'alice' }],
      getSettings: () => ({ branchPrefix: 'git-username', branchPrefixCustom: '' }),
      getWorktreeMeta: () => undefined,
      getAllWorktreeMeta: () => ({}),
      getFolderWorkspaces: () => [],
      getProjectGroups: () => []
    } as unknown as RuntimeStore

    const summary = buildRuntimeWorktreePsSummaries({
      store,
      resolvedWorktrees: [worktree],
      platformByRepoId: new Map()
    }).get(worktree.id)

    expect(summary?.head).toBe(head)
    expect(summary?.ownBranchPrefix).toBeUndefined()
  })

  it('sends the own prefix of a branch row, from the custom or the git-username strategy', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only these fields for a git row.
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      path: '/workspace/app',
      branch: 'refs/heads/alice/login',
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0
    } as unknown as ResolvedWorktree
    const withSettings = (settings: { branchPrefix: string; branchPrefixCustom: string }) =>
      ({
        getRepos: () => [{ id: 'repo-1', displayName: 'app', gitUsername: 'alice' }],
        getSettings: () => settings,
        getWorktreeMeta: () => undefined,
        getAllWorktreeMeta: () => ({}),
        getFolderWorkspaces: () => [],
        getProjectGroups: () => []
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only these store members.
      }) as unknown as RuntimeStore
    const prefixFor = (store: RuntimeStore) =>
      buildRuntimeWorktreePsSummaries({
        store,
        resolvedWorktrees: [worktree],
        platformByRepoId: new Map()
      }).get(worktree.id)?.ownBranchPrefix

    expect(prefixFor(withSettings({ branchPrefix: 'custom', branchPrefixCustom: 'alice' }))).toBe(
      'alice'
    )
    expect(prefixFor(withSettings({ branchPrefix: 'git-username', branchPrefixCustom: '' }))).toBe(
      'alice'
    )
    expect(prefixFor(withSettings({ branchPrefix: 'none', branchPrefixCustom: '' }))).toBeUndefined()
    expect(prefixFor(withSettings({ branchPrefix: 'unknown', branchPrefixCustom: '' }))).toBeUndefined()
  })
})
