import { describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { Repo } from '../../shared/repo-types'
import type { Worktree } from '../../shared/worktree/types'
import {
  linkedProjectReadPath,
  prepareLinkedTaskWorkspace,
  type LinkedTaskWorkspaceDeps
} from './bot-team-task-worktree'

/** Why: a fixture sets only the fields the listing reads; the rest of the record is never touched. */
function fixture<T>(fields: Partial<T>): T {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the listing reads only the fields a fixture sets.
  return fields as T
}

function deps(overrides: Partial<LinkedTaskWorkspaceDeps> = {}): LinkedTaskWorkspaceDeps {
  return {
    source: {
      listRepos: () => [
        fixture<Repo>({ id: 'repo-1', kind: 'git', path: '/work/nexus', displayName: 'NexusCare' }),
        fixture<Repo>({ id: 'repo-2', kind: 'folder', path: '/notes', displayName: 'Notes' })
      ],
      listWorktreeRows: async () => [
        fixture<Worktree>({ id: 'repo-1::/work/nexus', repoId: 'repo-1', path: '/work/nexus' }),
        fixture<Worktree>({ id: 'repo-1::/work/fix', repoId: 'repo-1', path: '/work/fix' }),
        fixture<Worktree>({ id: 'repo-2::/notes', repoId: 'repo-2', path: '/notes' })
      ],
      listProjectGroups: () => [],
      listFolderWorkspaces: () => [] as FolderWorkspace[]
    },
    createChildWorktree: vi.fn(async () => 'repo-1::/work/nexus-task-1'),
    relinkProject: vi.fn(),
    ...overrides
  }
}

const TASK = { projectId: 'project', taskTitle: 'Fix the login flow', workspaceKey: 'repo:repo-1' }

describe('prepareLinkedTaskWorkspace', () => {
  it('gives a task of a linked repo its own child worktree under the main checkout', async () => {
    const d = deps()

    await expect(prepareLinkedTaskWorkspace(d, TASK)).resolves.toBe('repo-1::/work/nexus-task-1')

    expect(d.createChildWorktree).toHaveBeenCalledWith({
      repoId: 'repo-1',
      name: expect.stringMatching(/^fix-the-login-flow-[0-9a-f]{6}$/),
      displayName: 'Fix the login flow',
      parentWorktreeId: 'repo-1::/work/nexus'
    })
    expect(d.relinkProject).not.toHaveBeenCalled()
  })

  it('runs a clearly read-only task in the main checkout, and an uncertain one in a child worktree', async () => {
    const d = deps()
    const review = { ...TASK, taskTitle: 'Review the login flow', taskPrompt: 'Review the code.' }

    await expect(prepareLinkedTaskWorkspace(d, review)).resolves.toBe('repo-1::/work/nexus')
    expect(d.createChildWorktree).not.toHaveBeenCalled()

    await prepareLinkedTaskWorkspace(d, { ...review, taskPrompt: 'Review and fix the code.' })
    expect(d.createChildWorktree).toHaveBeenCalledTimes(1)
  })

  it('gives two tasks of one repo two different worktrees', async () => {
    const d = deps()

    await prepareLinkedTaskWorkspace(d, TASK)
    await prepareLinkedTaskWorkspace(d, TASK)

    const names = vi.mocked(d.createChildWorktree).mock.calls.map(([call]) => call.name)
    expect(new Set(names).size).toBe(2)
  })

  it('runs a task of a linked folder project in the folder itself, without a worktree', async () => {
    const d = deps()

    await expect(
      prepareLinkedTaskWorkspace(d, { ...TASK, workspaceKey: 'repo:repo-2' })
    ).resolves.toBe('repo-2::/notes')
    expect(d.createChildWorktree).not.toHaveBeenCalled()
  })

  it('reads an old link to a worktree as its repo, rewrites it, and runs in a child worktree', async () => {
    const d = deps()

    await prepareLinkedTaskWorkspace(d, { ...TASK, workspaceKey: 'worktree:repo-1::/work/fix' })

    expect(d.relinkProject).toHaveBeenCalledWith('project', {
      key: 'repo:repo-1',
      name: 'NexusCare'
    })
    expect(d.createChildWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: 'repo-1' })
    )
  })

  it('returns null, creating nothing, when the linked project or worktree is gone', async () => {
    const d = deps()

    await expect(
      prepareLinkedTaskWorkspace(d, { ...TASK, workspaceKey: 'repo:repo-gone' })
    ).resolves.toBeNull()
    await expect(
      prepareLinkedTaskWorkspace(d, { ...TASK, workspaceKey: 'worktree:repo-1::/work/gone' })
    ).resolves.toBeNull()
    expect(d.createChildWorktree).not.toHaveBeenCalled()
    expect(d.relinkProject).not.toHaveBeenCalled()
  })

  it('fails the start, leaving the task in Todo, when the child worktree cannot be made', async () => {
    const d = deps({
      createChildWorktree: vi.fn(async () => {
        throw new Error('branch exists')
      })
    })

    await expect(prepareLinkedTaskWorkspace(d, TASK)).rejects.toThrow('branch exists')
  })
})

describe('linkedProjectReadPath', () => {
  const never = () => false

  it('is the main checkout path of a linked repo, never a child worktree', async () => {
    await expect(linkedProjectReadPath(deps().source, 'repo:repo-1', never)).resolves.toBe(
      '/work/nexus'
    )
  })

  it('is the folder of a folder repo', async () => {
    await expect(linkedProjectReadPath(deps().source, 'repo:repo-2', never)).resolves.toBe('/notes')
  })

  it('is null for a repo on a remote host, and for a project that is gone', async () => {
    await expect(
      linkedProjectReadPath(deps().source, 'repo:repo-1', (repoId) => repoId === 'repo-1')
    ).resolves.toBeNull()
    await expect(linkedProjectReadPath(deps().source, 'repo:ghost', never)).resolves.toBeNull()
  })
})
