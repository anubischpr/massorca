import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'

const { initializeGitInFolderRepo } = vi.hoisted(() => ({ initializeGitInFolderRepo: vi.fn() }))
vi.mock('./runtime-folder-git-initialization', () => ({ initializeGitInFolderRepo }))
vi.mock('../ipc/filesystem-auth', () => ({ invalidateAuthorizedRootsCache: vi.fn() }))
vi.mock('../worktree-root-preparation', () => ({ prepareLocalWorktreeRootForRepo: vi.fn() }))

import { RuntimeRepositorySettingsController } from './runtime-repository-settings-controller'

const repo: Repo = {
  id: 'repo-1',
  kind: 'folder',
  path: '/work/notes',
  displayName: 'notes',
  badgeColor: '#000000',
  addedAt: 1
}

function makeController(resolveRepo: (selector: string) => Promise<Repo>) {
  const deps = {
    getStore: vi.fn(() => Object.create(null)),
    resolveRepo: vi.fn(resolveRepo),
    forgetTerminalTopology: vi.fn(),
    invalidateResolvedWorktrees: vi.fn(),
    invalidateWorktreeScan: vi.fn(),
    notifyReposChanged: vi.fn()
  }
  return { controller: new RuntimeRepositorySettingsController(deps), deps }
}

beforeEach(() => initializeGitInFolderRepo.mockReset())

describe('RuntimeRepositorySettingsController.initializeGit', () => {
  it('publishes the repo change to every client after the kind flips', async () => {
    initializeGitInFolderRepo.mockResolvedValue({ ok: true, repo: { ...repo, kind: 'git' } })
    const { controller, deps } = makeController(async () => repo)

    await expect(controller.initializeGit('id:repo-1')).resolves.toMatchObject({ ok: true })

    expect(initializeGitInFolderRepo).toHaveBeenCalledWith(expect.anything(), 'repo-1')
    expect(deps.invalidateResolvedWorktrees).toHaveBeenCalledTimes(1)
    expect(deps.invalidateWorktreeScan).toHaveBeenCalledWith('repo-1')
    expect(deps.notifyReposChanged).toHaveBeenCalledTimes(1)
  })

  it('publishes nothing when the host refuses', async () => {
    initializeGitInFolderRepo.mockResolvedValue({ ok: false, error: 'has_folder_workspaces' })
    const { controller, deps } = makeController(async () => repo)

    await expect(controller.initializeGit('id:repo-1')).resolves.toEqual({
      ok: false,
      error: 'has_folder_workspaces'
    })
    expect(deps.notifyReposChanged).not.toHaveBeenCalled()
  })

  it('answers an unknown selector with a typed refusal and rethrows other failures', async () => {
    const missing = makeController(async () => {
      throw new Error('repo_not_found')
    })
    await expect(missing.controller.initializeGit('id:nope')).resolves.toEqual({
      ok: false,
      error: 'repo_not_found'
    })

    const ambiguous = makeController(async () => {
      throw new Error('selector_ambiguous')
    })
    await expect(ambiguous.controller.initializeGit('name:x')).rejects.toThrow('selector_ambiguous')
    expect(initializeGitInFolderRepo).not.toHaveBeenCalled()
  })
})
