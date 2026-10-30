// The project a chat works in, for its design system: the root that holds design/system/, a name to
// show, and a key that tells projects apart. A linked worktree shares the system of its main checkout;
// a folder workspace without git is its own root.

import { createHash } from 'node:crypto'
import { lstat, open } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const MAX_GIT_FILE_BYTES = 4096
const LINKED_WORKTREE_GITDIR = /^(.*)[\\/]\.git[\\/]worktrees[\\/][^\\/]+[\\/]?$/u
const RELATIVE_GITDIR = /^\.\.?[\\/]/u
const BARE_REPOSITORY = /^\s*bare\s*=\s*true\s*$/mu
const PROJECT_KEY_LENGTH = 16

export type DesignSystemProject = {
  /**
   * Where design/system/ lives: the nearest folder at or above the launch directory with a `.git`, or the
   * main checkout when that folder is a linked worktree whose main checkout is on this host.
   */
  root: string
  projectName: string
  /** Stable for one root on one host; every linked worktree of a repository shares its main checkout's key. */
  projectKey: string
  /** The linked worktree's own root, set only when `root` is its main checkout; a system written there is migrated. */
  worktreeRoot?: string
}

/** The project of a chat's launch directory; the directory itself when no ancestor holds a `.git`. */
export async function resolveDesignSystemProject(
  launchDirectory: string
): Promise<DesignSystemProject> {
  const start = resolve(launchDirectory)
  const git = await nearestGit(start)
  const gitRoot = git?.root ?? start
  const repository = git?.isFile === true ? await linkedWorktreeRepository(gitRoot) : null
  const mainCheckout = repository === null ? null : await mainCheckoutOf(repository)
  const root = mainCheckout ?? gitRoot
  return {
    root,
    projectName: folderName(repository ?? gitRoot),
    projectKey: projectKeyOf(root),
    ...(mainCheckout !== null && mainCheckout !== gitRoot ? { worktreeRoot: gitRoot } : {})
  }
}

type GitEntry = { root: string; isFile: boolean }

// A `.git` folder, or the `.git` file of a linked worktree or submodule, ends the walk up.
async function nearestGit(start: string): Promise<GitEntry | null> {
  for (let directory = start; ; directory = dirname(directory)) {
    const stats = await lstat(join(directory, '.git')).catch(() => null)
    if (stats !== null && (stats.isDirectory() || stats.isFile())) {
      return { root: directory, isFile: stats.isFile() }
    }
    if (dirname(directory) === directory) {
      return null
    }
  }
}

// The repository a linked worktree belongs to, from its `.git` file; null for a submodule or an unreadable pointer.
async function linkedWorktreeRepository(root: string): Promise<string | null> {
  const text = await readSmallText(join(root, '.git'))
  const gitdir = /^gitdir:\s*(.+?)\s*$/mu.exec(text ?? '')?.[1]
  if (gitdir === undefined) {
    return null
  }
  const absolute = RELATIVE_GITDIR.test(gitdir) ? resolve(root, gitdir) : gitdir
  return LINKED_WORKTREE_GITDIR.exec(absolute)?.[1] ?? null
}

// A bare repository has no checkout to hold the system, and a missing one cannot be written to.
async function mainCheckoutOf(repository: string): Promise<string | null> {
  const gitDirectory = join(repository, '.git')
  const stats = await lstat(gitDirectory).catch(() => null)
  if (stats === null || !stats.isDirectory()) {
    return null
  }
  const config = await readSmallText(join(gitDirectory, 'config'))
  return config !== null && BARE_REPOSITORY.test(config) ? null : resolve(repository)
}

async function readSmallText(path: string): Promise<string | null> {
  try {
    const handle = await open(path, 'r')
    try {
      const buffer = Buffer.alloc(MAX_GIT_FILE_BYTES)
      const { bytesRead } = await handle.read(buffer, 0, MAX_GIT_FILE_BYTES, 0)
      return buffer.toString('utf8', 0, bytesRead)
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

// Either separator style names the last folder, whichever host wrote the path.
function folderName(path: string): string {
  const name = basename(path.replace(/[\\/]+$/u, '').replaceAll('\\', '/'))
  return name.length > 0 ? name : path
}

function projectKeyOf(root: string): string {
  const normalized = process.platform === 'win32' ? root.toLowerCase() : root
  return createHash('sha256').update(normalized).digest('hex').slice(0, PROJECT_KEY_LENGTH)
}
