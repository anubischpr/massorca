import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Repo } from '../../shared/repo-types'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { INITIAL_COMMIT_IDENTITY_ARGS } from '../../shared/git-initial-commit-identity'

type SshGitStub = {
  exec: ReturnType<typeof vi.fn>
  isGitRepoAsync: ReturnType<typeof vi.fn>
  getHostPlatform: () => { pathFlavor: 'posix' | 'windows' } | undefined
}
type SshFsStub = { stat: ReturnType<typeof vi.fn>; deletePath: ReturnType<typeof vi.fn> }

const { sshGit, sshFs } = vi.hoisted(
  (): {
    sshGit: { current: SshGitStub | undefined }
    sshFs: { current: SshFsStub | undefined }
  } => ({ sshGit: { current: undefined }, sshFs: { current: undefined } })
)

vi.mock('../providers/ssh-git-dispatch', () => ({
  getSshGitProvider: () => sshGit.current
}))
vi.mock('../providers/ssh-filesystem-dispatch', () => ({
  getSshFilesystemProvider: () => sshFs.current
}))
vi.mock('../ipc/filesystem-auth', () => ({ invalidateAuthorizedRootsCache: vi.fn() }))
vi.mock('../worktree-root-preparation', () => ({
  prepareLocalWorktreeRootForRepo: vi.fn(async () => {})
}))

import { prepareLocalWorktreeRootForRepo } from '../worktree-root-preparation'
import { initializeGitInFolderRepo } from './runtime-folder-git-initialization'

function makeRepo(overrides: Partial<Repo> & Pick<Repo, 'id' | 'path'>): Repo {
  return {
    displayName: overrides.id,
    badgeColor: '#000000',
    addedAt: 1,
    kind: 'folder',
    ...overrides
  }
}

function makeStore(
  repos: Repo[],
  worktreeMeta: Record<string, unknown> = {}
): Parameters<typeof initializeGitInFolderRepo>[0] {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the function under test reads only these store members.
  return {
    getRepo: vi.fn((id: string) => repos.find((repo) => repo.id === id)),
    updateRepo: vi.fn((id: string, updates: Partial<Repo>) => {
      const index = repos.findIndex((repo) => repo.id === id)
      if (index === -1) {
        return null
      }
      repos[index] = { ...repos[index]!, ...updates }
      return repos[index]!
    }),
    getAllWorktreeMeta: () => worktreeMeta,
    getSettings: () => ({})
  } as unknown as Parameters<typeof initializeGitInFolderRepo>[0]
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

describe('initializeGitInFolderRepo (local)', () => {
  let root: string

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'orca-folder-git-init-')))
    vi.mocked(prepareLocalWorktreeRootForRepo).mockClear()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(root, { recursive: true, force: true })
  })

  it('creates the repo with one empty commit, leaves files uncommitted, and flips the kind', async () => {
    await writeFile(join(root, 'notes.txt'), 'draft')
    const repos = [makeRepo({ id: 'r1', path: root })]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'r1')

    expect(result).toMatchObject({ ok: true, repo: { id: 'r1', kind: 'git' } })
    expect(repos[0]).toMatchObject({
      kind: 'git',
      externalWorktreeVisibility: 'hide'
    })
    // Git spells the root with forward slashes on Windows.
    expect(normalizeRuntimePathForComparison(repos[0]!.folderUpgradeGitRootPath ?? '')).toBe(
      normalizeRuntimePathForComparison(root)
    )
    expect(git(root, 'rev-list', '--count', 'HEAD')).toBe('1')
    expect(git(root, 'log', '-1', '--format=%s')).toBe('Initial commit')
    expect(git(root, 'status', '--porcelain')).toBe('?? notes.txt')
    expect(prepareLocalWorktreeRootForRepo).toHaveBeenCalledTimes(1)
  })

  it('retries the empty commit with the fallback author when no identity is configured', async () => {
    vi.stubEnv('GIT_CONFIG_GLOBAL', join(root, 'no-such-global-config'))
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
    vi.stubEnv('GIT_CONFIG_COUNT', '1')
    vi.stubEnv('GIT_CONFIG_KEY_0', 'user.useConfigOnly')
    vi.stubEnv('GIT_CONFIG_VALUE_0', 'true')
    for (const key of ['NAME', 'EMAIL']) {
      vi.stubEnv(`GIT_AUTHOR_${key}`, undefined)
      vi.stubEnv(`GIT_COMMITTER_${key}`, undefined)
    }
    const project = join(root, 'project')
    await mkdir(project)
    const repos = [makeRepo({ id: 'r1', path: project })]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'r1')

    expect(result).toMatchObject({ ok: true })
    expect(git(project, 'log', '-1', '--format=%an <%ae>')).toBe('Orca <orca@localhost>')
  })

  it('skips init and only flips the kind when the folder is already a repository root', async () => {
    git(root, 'init')
    const repos = [makeRepo({ id: 'r1', path: root })]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'r1')

    expect(result).toMatchObject({ ok: true, repo: { kind: 'git' } })
    // No commit is invented for a repository the user created themselves.
    expect(() => git(root, 'rev-parse', '--verify', 'HEAD')).toThrow()
  })

  it('refuses a stray marker that is not the work-tree root', async () => {
    git(root, 'init')
    const nested = join(root, 'packages', 'app')
    await mkdir(nested, { recursive: true })
    await writeFile(join(nested, '.git'), 'gitdir: ../../nowhere\n')
    const repos = [makeRepo({ id: 'r1', path: nested })]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'r1')

    expect(result).toEqual({ ok: false, error: 'not_a_repository_root' })
    expect(repos[0]!.kind).toBe('folder')
  })

  it('creates a nested repository when the folder sits inside a parent repository', async () => {
    git(root, 'init')
    const nested = join(root, 'inner')
    await mkdir(nested)
    const repos = [makeRepo({ id: 'r1', path: nested })]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'r1')

    expect(result.ok).toBe(true)
    expect(existsSync(join(nested, '.git'))).toBe(true)
    expect(await realpath(git(nested, 'rev-parse', '--show-toplevel'))).toBe(nested)
  })

  it('refuses unknown repos, git projects, and folders with extra folder workspaces', async () => {
    const repos = [
      makeRepo({ id: 'git', path: join(root, 'a'), kind: 'git' }),
      makeRepo({ id: 'busy', path: join(root, 'b') })
    ]
    await mkdir(join(root, 'b'))
    const store = makeStore(repos, { [`busy::${join(root, 'b')}::workspace:abc`]: {} })

    await expect(initializeGitInFolderRepo(store, 'missing')).resolves.toEqual({
      ok: false,
      error: 'repo_not_found'
    })
    await expect(initializeGitInFolderRepo(store, 'git')).resolves.toEqual({
      ok: false,
      error: 'not_a_folder_project'
    })
    await expect(initializeGitInFolderRepo(store, 'busy')).resolves.toEqual({
      ok: false,
      error: 'has_folder_workspaces'
    })
    expect(existsSync(join(root, 'b', '.git'))).toBe(false)
  })

  it('shares one run between concurrent requests for the same repo', async () => {
    const repos = [makeRepo({ id: 'r1', path: root })]
    const store = makeStore(repos)

    const [first, second] = await Promise.all([
      initializeGitInFolderRepo(store, 'r1'),
      initializeGitInFolderRepo(store, 'r1')
    ])

    expect(first).toBe(second)
    expect(git(root, 'rev-list', '--count', 'HEAD')).toBe('1')
  })
})

describe('initializeGitInFolderRepo (SSH host)', () => {
  const remotePath = '/srv/project'

  function sshRepo(): Repo {
    return makeRepo({
      id: 'ssh1',
      path: remotePath,
      connectionId: 'conn-1',
      executionHostId: 'ssh:conn-1'
    })
  }

  beforeEach(() => {
    sshGit.current = {
      exec: vi.fn(async () => ({ stdout: '', stderr: '' })),
      isGitRepoAsync: vi.fn(async () => ({ isRepo: true, rootPath: remotePath })),
      getHostPlatform: () => ({ pathFlavor: 'posix' })
    }
    sshFs.current = {
      stat: vi.fn(async () => {
        throw new Error('ENOENT')
      }),
      deletePath: vi.fn(async () => {})
    }
  })

  afterEach(() => {
    sshGit.current = undefined
    sshFs.current = undefined
  })

  it('runs init and the empty commit on the SSH host, never locally', async () => {
    const repos = [sshRepo()]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'ssh1')

    expect(result).toMatchObject({ ok: true, repo: { kind: 'git', connectionId: 'conn-1' } })
    expect(sshGit.current!.exec.mock.calls).toEqual([
      [['init'], remotePath],
      [['commit', '--allow-empty', '-m', 'Initial commit'], remotePath]
    ])
    expect(repos[0]).toMatchObject({
      folderUpgradeGitRootPath: remotePath,
      externalWorktreeVisibility: 'hide'
    })
  })

  it('retries with the fallback author through the relay when the host has no identity', async () => {
    sshGit.current!.exec.mockImplementation(async (args: string[]) => {
      if (args[0] === 'commit') {
        throw new Error('Please tell me who you are.')
      }
      return { stdout: '', stderr: '' }
    })

    const result = await initializeGitInFolderRepo(makeStore([sshRepo()]), 'ssh1')

    expect(result).toMatchObject({ ok: true, repo: { kind: 'git' } })
    const attempts = sshGit.current!.exec.mock.calls.map((call) => call[0])
    expect(attempts.at(-1)).toEqual([
      ...INITIAL_COMMIT_IDENTITY_ARGS,
      'commit',
      '--allow-empty',
      '-m',
      'Initial commit'
    ])
  })

  it('rolls the new marker back when even the fallback author is refused', async () => {
    sshGit.current!.exec.mockImplementation(async (args: string[]) => {
      if (args.includes('commit')) {
        throw new Error(args[0] === '-c' ? 'Global git flags are not allowed' : 'user.email unset')
      }
      return { stdout: '', stderr: '' }
    })

    const result = await initializeGitInFolderRepo(makeStore([sshRepo()]), 'ssh1')

    expect(result).toMatchObject({ ok: false, error: 'git_identity_unavailable' })
    expect(sshFs.current!.deletePath).toHaveBeenCalledWith(`${remotePath}/.git`, true)
  })

  it('reports a commit failure that is not about identity and rolls the marker back', async () => {
    sshGit.current!.exec.mockImplementation(async (args: string[]) => {
      if (args[0] === 'commit') {
        throw new Error('disk full')
      }
      return { stdout: '', stderr: '' }
    })
    const repos = [sshRepo()]

    const result = await initializeGitInFolderRepo(makeStore(repos), 'ssh1')

    expect(result).toEqual({ ok: false, error: 'git_commit_failed', message: 'disk full' })
    expect(repos[0]!.kind).toBe('folder')
    expect(sshFs.current!.deletePath).toHaveBeenCalledTimes(1)
  })

  it('skips init when the host already has a .git at the root', async () => {
    sshFs.current!.stat.mockResolvedValue({ size: 0, type: 'directory', mtime: 0 })

    const result = await initializeGitInFolderRepo(makeStore([sshRepo()]), 'ssh1')

    expect(result).toMatchObject({ ok: true, repo: { kind: 'git' } })
    expect(sshGit.current!.exec).not.toHaveBeenCalled()
  })

  it('reports an unavailable host when the SSH connection is gone', async () => {
    sshGit.current = undefined

    await expect(initializeGitInFolderRepo(makeStore([sshRepo()]), 'ssh1')).resolves.toEqual({
      ok: false,
      error: 'host_unavailable'
    })
  })
})
