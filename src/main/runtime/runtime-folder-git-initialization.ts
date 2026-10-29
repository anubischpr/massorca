import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getRepoSshConnectionId } from '../../shared/execution-host'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import {
  GIT_IDENTITY_MISSING_PATTERN,
  INITIAL_COMMIT_IDENTITY_ARGS,
  INITIAL_COMMIT_MESSAGE
} from '../../shared/git-initial-commit-identity'
import { isFolderRepo } from '../../shared/repo-kind'
import type { Repo } from '../../shared/repo-types'
import type { RepoInitGitResult } from '../../shared/rpc-contract/repo-init-git-params'
import { gitExecFileAsync } from '../git/runner'
import {
  hasExtraFolderWorkspaces,
  resolveUpgrade
} from '../ipc/folder-repo-git-upgrade-eligibility'
import { invalidateAuthorizedRootsCache } from '../ipc/filesystem-auth'
import { getSshFilesystemProvider } from '../providers/ssh-filesystem-dispatch'
import { getSshGitProvider } from '../providers/ssh-git-dispatch'
import { joinRemotePath } from '../ssh/ssh-remote-platform'
import { prepareLocalWorktreeRootForRepo } from '../worktree-root-preparation'
import type { RuntimeStore } from './runtime-store-contract'

type GitRootUpgrade = {
  folderUpgradeGitRootPath: string
  externalWorktreeVisibility?: 'hide'
}

// One host-side seam so local and SSH folders share the same init steps.
type FolderGitHost = {
  gitMarkerExists: () => Promise<boolean>
  git: (args: string[]) => Promise<void>
  removeGitMarker: () => Promise<void>
  /** Git's verdict on the folder, or null when it is not the work-tree root. */
  readRepositoryRoot: (createdByUs: boolean) => Promise<GitRootUpgrade | null>
}

type InitStore = Pick<
  RuntimeStore,
  'getRepo' | 'updateRepo' | 'getAllWorktreeMeta' | 'getSettings' | 'getProjects'
>

function localFolderGitHost(repoPath: string): FolderGitHost {
  return {
    gitMarkerExists: () =>
      stat(join(repoPath, '.git')).then(
        () => true,
        () => false
      ),
    git: async (args) => {
      await gitExecFileAsync(args, { cwd: repoPath })
    },
    removeGitMarker: () => rm(join(repoPath, '.git'), { recursive: true, force: true }),
    readRepositoryRoot: async () => resolveUpgrade(repoPath)
  }
}

function sshFolderGitHost(repo: Repo, connectionId: string): FolderGitHost | null {
  const gitProvider = getSshGitProvider(connectionId)
  const fsProvider = getSshFilesystemProvider(connectionId)
  const host = gitProvider?.getHostPlatform?.()
  if (!gitProvider || !fsProvider || !host) {
    return null
  }
  const markerPath = joinRemotePath(host, repo.path, '.git')
  return {
    gitMarkerExists: () =>
      fsProvider.stat(markerPath).then(
        () => true,
        () => false
      ),
    git: async (args) => {
      await gitProvider.exec(args, repo.path)
    },
    removeGitMarker: () => fsProvider.deletePath(markerPath, true),
    readRepositoryRoot: async (createdByUs) => {
      const check = await gitProvider.isGitRepoAsync(repo.path)
      if (!check.isRepo) {
        return null
      }
      const root = check.rootPath ?? repo.path
      if (
        normalizeRuntimePathForComparison(root) === normalizeRuntimePathForComparison(repo.path)
      ) {
        return { folderUpgradeGitRootPath: root, externalWorktreeVisibility: 'hide' }
      }
      // A remote spelling cannot be resolved here; a repo this call just created is the root.
      return createdByUs ? { folderUpgradeGitRootPath: root } : null
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function createInitialCommit(host: FolderGitHost): Promise<RepoInitGitResult | null> {
  const commit = ['commit', '--allow-empty', '-m', INITIAL_COMMIT_MESSAGE]
  try {
    await host.git(commit)
    return null
  } catch (error) {
    if (!GIT_IDENTITY_MISSING_PATTERN.test(errorMessage(error))) {
      return { ok: false, error: 'git_commit_failed', message: errorMessage(error) }
    }
  }
  try {
    // Global -c goes before the subcommand, the only place git reads it.
    await host.git([...INITIAL_COMMIT_IDENTITY_ARGS, ...commit])
    return null
  } catch (error) {
    return { ok: false, error: 'git_identity_unavailable', message: errorMessage(error) }
  }
}

async function initializeOnHost(
  store: InitStore,
  repo: Repo,
  host: FolderGitHost
): Promise<RepoInitGitResult> {
  const markerExisted = await host.gitMarkerExists()
  if (!markerExisted) {
    try {
      await host.git(['init'])
    } catch (error) {
      return { ok: false, error: 'git_init_failed', message: errorMessage(error) }
    }
    const failure = await createInitialCommit(host)
    if (failure) {
      // Only the marker this call just created is removed; the user's files are never touched.
      await host.removeGitMarker().catch(() => {})
      return failure
    }
  }
  const upgrade = await host.readRepositoryRoot(!markerExisted).catch(() => null)
  if (!upgrade) {
    return { ok: false, error: 'not_a_repository_root' }
  }
  const upgraded = store.updateRepo(repo.id, { kind: 'git', ...upgrade })
  if (!upgraded) {
    return { ok: false, error: 'repo_not_found' }
  }
  await prepareLocalWorktreeRootForRepo(store, upgraded)
  invalidateAuthorizedRootsCache()
  return { ok: true, repo: upgraded }
}

const inFlightByRepoId = new Map<string, Promise<RepoInitGitResult>>()

/**
 * Runs `git init` and an empty first commit in a folder project's own path on the host that owns
 * it, then flips the project to `kind: 'git'`. An existing `.git` at the root skips init and only
 * flips the kind. Refuses a project with extra folder workspaces, which the git branch would drop.
 */
export function initializeGitInFolderRepo(
  store: InitStore,
  repoId: string
): Promise<RepoInitGitResult> {
  const running = inFlightByRepoId.get(repoId)
  if (running) {
    return running
  }
  const run = (async (): Promise<RepoInitGitResult> => {
    const repo = store.getRepo(repoId)
    if (!repo) {
      return { ok: false, error: 'repo_not_found' }
    }
    if (!isFolderRepo(repo)) {
      return { ok: false, error: 'not_a_folder_project' }
    }
    if (hasExtraFolderWorkspaces(store, repo)) {
      return { ok: false, error: 'has_folder_workspaces' }
    }
    const connectionId = getRepoSshConnectionId(repo)
    const host = connectionId ? sshFolderGitHost(repo, connectionId) : localFolderGitHost(repo.path)
    if (!host) {
      return { ok: false, error: 'host_unavailable' }
    }
    return initializeOnHost(store, repo, host)
  })().finally(() => inFlightByRepoId.delete(repoId))
  inFlightByRepoId.set(repoId, run)
  return run
}
