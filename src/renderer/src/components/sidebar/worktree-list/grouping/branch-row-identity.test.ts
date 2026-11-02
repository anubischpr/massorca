import { describe, expect, it } from 'vitest'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host'
import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import {
  repo as baseRepo,
  worktree as baseWorktree
} from '../../worktree-list-groups-test-fixtures'
import {
  attachBranchRowIdentity,
  getBranchQualifiers,
  type BranchQualifierInput
} from './branch-row-identity'
import { PINNED_GROUP_KEY } from './group-keys'
import type { Row, WorktreeRow } from './row-types'

function input(overrides: Partial<BranchQualifierInput>): BranchQualifierInput {
  return {
    identity: 'a',
    name: 'main',
    projectKey: 'p1',
    projectLabel: 'Alpha',
    hostId: 'local',
    hostLabel: 'This computer',
    ...overrides
  }
}

describe('getBranchQualifiers', () => {
  it('names nothing when no name repeats', () => {
    const qualifiers = getBranchQualifiers(
      [input({ identity: 'a', name: 'one' }), input({ identity: 'b', name: 'two' })],
      'list'
    )
    expect(qualifiers.size).toBe(0)
  })

  it('names only the host when one project has the same name on two hosts', () => {
    const qualifiers = getBranchQualifiers(
      [
        input({ identity: 'a', hostId: 'local', hostLabel: 'This computer' }),
        input({ identity: 'b', hostId: 'ssh:gpu', hostLabel: 'gpu-box' })
      ],
      'project'
    )
    expect(qualifiers.get('a')).toBe('This computer')
    expect(qualifiers.get('b')).toBe('gpu-box')
  })

  it('names only the project when ungrouped rows of two projects share a name on one host', () => {
    const qualifiers = getBranchQualifiers(
      [
        input({ identity: 'a', projectKey: 'p1', projectLabel: 'Alpha' }),
        input({ identity: 'b', projectKey: 'p2', projectLabel: 'Beta' })
      ],
      'list'
    )
    expect(qualifiers.get('a')).toBe('Alpha')
    expect(qualifiers.get('b')).toBe('Beta')
  })

  it('names both when project and host both differ', () => {
    const qualifiers = getBranchQualifiers(
      [
        input({ identity: 'a', projectKey: 'p1', projectLabel: 'Alpha', hostId: 'local' }),
        input({
          identity: 'b',
          projectKey: 'p2',
          projectLabel: 'Beta',
          hostId: 'ssh:gpu',
          hostLabel: 'gpu-box'
        })
      ],
      'list'
    )
    expect(qualifiers.get('b')).toBe('Beta · gpu-box')
  })

  it('does not compare across projects inside a project-grouped list', () => {
    const qualifiers = getBranchQualifiers(
      [
        input({ identity: 'a', projectKey: 'p1' }),
        input({ identity: 'b', projectKey: 'p2', hostId: 'ssh:gpu' })
      ],
      'project'
    )
    expect(qualifiers.size).toBe(0)
  })

  it('names nothing for the same name twice on the same host in one project', () => {
    const qualifiers = getBranchQualifiers(
      [input({ identity: 'a' }), input({ identity: 'b' })],
      'project'
    )
    expect(qualifiers.size).toBe(0)
  })

  it('names the parent folder when two folders of one project and host share a name', () => {
    const qualifiers = getBranchQualifiers(
      [
        input({ identity: 'a', name: 'app', location: 'work' }),
        input({ identity: 'b', name: 'app', location: 'old' })
      ],
      'project'
    )
    expect(qualifiers.get('a')).toBe('work')
    expect(qualifiers.get('b')).toBe('old')
  })

  it('names nothing for a row without a name', () => {
    const qualifiers = getBranchQualifiers(
      [input({ identity: 'a', name: '' }), input({ identity: 'b', name: '' })],
      'list'
    )
    expect(qualifiers.size).toBe(0)
  })
})

function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return { ...baseRepo, id, path: `/work/${id}`, displayName: id, ...overrides }
}

function makeWorktree(
  id: string,
  repoId: string,
  branch: string,
  overrides: Partial<Worktree> = {}
) {
  return {
    ...baseWorktree,
    id,
    repoId,
    path: `/work/${id}`,
    branch: `refs/heads/${branch}`,
    displayName: branch,
    ...overrides
  }
}

function itemRow(worktree: Worktree, sectionKey = 'repo:r1'): WorktreeRow {
  return {
    type: 'item',
    rowKey: `${sectionKey}:${worktree.id}`,
    sectionKey,
    worktree,
    repo: undefined,
    depth: 0,
    groupDepth: 0,
    lineageTrail: [],
    isLastLineageChild: false,
    lineageChildCount: 0
  }
}

function attach(
  rows: Row[],
  worktrees: Worktree[],
  repos: Repo[],
  options: {
    groupBy?: 'repo' | 'none'
    branchPrefixSettings?: Parameters<typeof attachBranchRowIdentity>[1]['branchPrefixSettings']
  } = {}
): void {
  attachBranchRowIdentity(rows, {
    groupBy: options.groupBy ?? 'repo',
    worktrees,
    repoMap: new Map(repos.map((candidate) => [candidate.id, candidate])),
    projectIndex: null,
    branchPrefixSettings: options.branchPrefixSettings ?? null,
    hostLabelById: undefined,
    defaultHostId: LOCAL_EXECUTION_HOST_ID
  })
}

describe('attachBranchRowIdentity', () => {
  it('hides only the user own prefix and keeps a teammate prefix', () => {
    const r1 = makeRepo('r1', { gitUsername: 'alice' })
    const mine = makeWorktree('w1', 'r1', 'alice/fix-login')
    const theirs = makeWorktree('w2', 'r1', 'bob/fix-search')
    const rows = [itemRow(mine), itemRow(theirs)]

    attach(rows, [mine, theirs], [r1], { branchPrefixSettings: { branchPrefix: 'git-username' } })

    expect(rows.map((row) => (row.type === 'item' ? row.branchLabel : null))).toEqual([
      'fix-login',
      'bob/fix-search'
    ])
  })

  it('shows the full branch when no own prefix is configured', () => {
    const r1 = makeRepo('r1', { gitUsername: 'alice' })
    const mine = makeWorktree('w1', 'r1', 'alice/fix-login')
    const rows = [itemRow(mine)]

    attach(rows, [mine], [r1], { branchPrefixSettings: { branchPrefix: 'none' } })

    expect(rows[0].type === 'item' && rows[0].branchLabel).toBe('alice/fix-login')
  })

  it('does not fold two different branches into one label', () => {
    const r1 = makeRepo('r1', { gitUsername: 'alice' })
    const prefixed = makeWorktree('w1', 'r1', 'alice/fix')
    const plain = makeWorktree('w2', 'r1', 'fix')
    const rows = [itemRow(prefixed), itemRow(plain)]

    attach(rows, [prefixed, plain], [r1], {
      branchPrefixSettings: { branchPrefix: 'git-username' }
    })

    expect(rows.map((row) => (row.type === 'item' ? row.branchLabel : null))).toEqual([
      'alice/fix',
      'fix'
    ])
  })

  it('counts a collapsed project worktree toward a collision', () => {
    const local = makeRepo('r1')
    const remote = makeRepo('r1', { connectionId: 'gpu', executionHostId: 'ssh:gpu' })
    const here = makeWorktree('w1', 'r1', 'main', { hostId: 'local' })
    // Collapsed: this worktree has no emitted row, yet still collides.
    const there = makeWorktree('w1', 'r1', 'main', { hostId: 'ssh:gpu' })
    const rows = [itemRow(here)]

    attach(rows, [here, there], [local, remote])

    expect(rows[0].type === 'item' && rows[0].branchQualifier).toBeTruthy()
  })

  it('compares projects too in a flat list and in the pinned section', () => {
    const a = makeRepo('ra')
    const b = makeRepo('rb')
    const wa = makeWorktree('wa', 'ra', 'main')
    const wb = makeWorktree('wb', 'rb', 'main')

    const flat = [itemRow(wa, 'all'), itemRow(wb, 'all')]
    attach(flat, [wa, wb], [a, b], { groupBy: 'none' })
    expect(flat.map((row) => (row.type === 'item' ? row.branchQualifier : null))).toEqual([
      'ra',
      'rb'
    ])

    const pinned = [itemRow(wa, PINNED_GROUP_KEY)]
    attach(pinned, [wa, wb], [a, b], { groupBy: 'repo' })
    expect(pinned[0].type === 'item' && pinned[0].branchQualifier).toBe('ra')

    const grouped = [itemRow(wa, 'repo:ra')]
    attach(grouped, [wa, wb], [a, b], { groupBy: 'repo' })
    expect(grouped[0].type === 'item' && grouped[0].branchQualifier).toBeUndefined()
  })

  it('de-duplicates a stripped label across projects in a flat list only', () => {
    const r1 = makeRepo('r1', { gitUsername: 'alice' })
    const r2 = makeRepo('r2')
    const mine = makeWorktree('wa', 'r1', 'alice/fix-login')
    const theirs = makeWorktree('wb', 'r2', 'fix-login')
    const options = { branchPrefixSettings: { branchPrefix: 'git-username' as const } }

    const flat = [itemRow(mine, 'all'), itemRow(theirs, 'all')]
    attach(flat, [mine, theirs], [r1, r2], { ...options, groupBy: 'none' })
    expect(flat.map((row) => (row.type === 'item' ? row.branchLabel : null))).toEqual([
      'alice/fix-login',
      'fix-login'
    ])

    const grouped = [itemRow(mine, 'repo:r1'), itemRow(theirs, 'repo:r2')]
    attach(grouped, [mine, theirs], [r1, r2], { ...options, groupBy: 'repo' })
    expect(grouped.map((row) => (row.type === 'item' ? row.branchLabel : null))).toEqual([
      'fix-login',
      'fix-login'
    ])
  })

  it('qualifies two folder workspaces that share a name on two hosts', () => {
    const folders = makeRepo('fr', { kind: 'folder', displayName: 'Folders' })
    const here = makeWorktree('f1', 'fr', '', {
      branch: '',
      head: '',
      path: '/work/app',
      hostId: 'local'
    })
    const there = makeWorktree('f2', 'fr', '', {
      branch: '',
      head: '',
      path: '/srv/app',
      hostId: 'ssh:gpu'
    })
    const rows = [itemRow(here, 'repo:fr'), itemRow(there, 'repo:fr')]

    attach(rows, [here, there], [folders], { groupBy: 'repo' })

    const qualifiers = rows.map((row) => (row.type === 'item' ? row.branchQualifier : undefined))
    expect(qualifiers[0]).toBeTruthy()
    expect(qualifiers[1]).toBeTruthy()
    expect(qualifiers[0]).not.toBe(qualifiers[1])
  })

  it('tells two folders of one project and host apart by their parent folder', () => {
    const folders = makeRepo('fr', { kind: 'folder', displayName: 'Folders' })
    const work = makeWorktree('f1', 'fr', '', { branch: '', head: '', path: '/work/app' })
    const old = makeWorktree('f2', 'fr', '', { branch: '', head: '', path: '/old/app' })
    const rows = [itemRow(work, 'repo:fr'), itemRow(old, 'repo:fr')]

    attach(rows, [work, old], [folders], { groupBy: 'repo' })

    expect(rows.map((row) => (row.type === 'item' ? row.branchQualifier : null))).toEqual([
      'work',
      'old'
    ])
  })

  it('compares a detached HEAD by its short SHA across hosts', () => {
    const r1 = makeRepo('r1')
    const here = makeWorktree('d1', 'r1', '', {
      branch: '',
      head: 'abc1234def5678',
      hostId: 'local'
    })
    const there = makeWorktree('d2', 'r1', '', {
      branch: '',
      head: 'abc1234def5678',
      hostId: 'ssh:gpu'
    })
    const rows = [itemRow(here), itemRow(there)]

    attach(rows, [here, there], [r1])

    const qualifiers = rows.map((row) => (row.type === 'item' ? row.branchQualifier : undefined))
    expect(qualifiers[0]).toBeTruthy()
    expect(qualifiers[0]).not.toBe(qualifiers[1])
  })
})
