// The project a chat works in, for its design system: the root that holds design/system/, a name to
// show, and a key that tells projects apart. A folder workspace without git is its own root.

import { createHash } from 'node:crypto'
import { lstat, open } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const MAX_GIT_FILE_BYTES = 4096
const LINKED_WORKTREE_GITDIR = /^(.*)[\\/]\.git[\\/]worktrees[\\/][^\\/]+[\\/]?$/u
const PROJECT_KEY_LENGTH = 16

export type DesignSystemProject = {
  /** Where design/system/ lives: the nearest folder at or above the launch directory with a `.git`. */
  root: string
  projectName: string
  /** Stable for one root on one host; two linked worktrees of a repository are two projects. */
  projectKey: string
}

/** The project of a chat's launch directory; the directory itself when no ancestor holds a `.git`. */
export async function resolveDesignSystemProject(
  launchDirectory: string
): Promise<DesignSystemProject> {
  const start = resolve(launchDirectory)
  const git = await nearestGit(start)
  const root = git?.root ?? start
  return {
    root,
    projectName: await projectNameOf(root, git?.isFile === true),
    projectKey: projectKeyOf(root)
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

// A linked worktree is named for the repository it belongs to, not for its own folder.
async function projectNameOf(root: string, gitIsFile: boolean): Promise<string> {
  const repository = gitIsFile ? await linkedWorktreeRepository(root) : null
  return folderName(repository ?? root)
}

async function linkedWorktreeRepository(root: string): Promise<string | null> {
  const text = await readSmallText(join(root, '.git'))
  const gitdir = /^gitdir:\s*(.+?)\s*$/mu.exec(text ?? '')?.[1]
  return gitdir === undefined ? null : (LINKED_WORKTREE_GITDIR.exec(gitdir)?.[1] ?? null)
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
