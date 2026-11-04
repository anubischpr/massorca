import { lstatSync } from 'node:fs'
import path from 'node:path'
import type { AgentSessionStatusEvent } from '../../shared/agent-session-wire'
import { WORKTREE_ID_SEPARATOR } from '../../shared/pty-session-id-format'
import { normalizeWorkspaceSessionKeyToWorkspaceId } from '../../shared/workspace-scope'
import {
  getExecutionHostIdFromWorktreeHostIdentity,
  isWorktreeHostIdentity
} from '../../shared/worktree/host-qualified-identity'
import { gitExecFileAsync } from '../git/command-runner/git-exec-file'
import { isCopyableFile } from './bot-team-deliverables-copyable'

/** A worktree a session ran in: its folder, and whether this host can read it. */
export type WorktreeLocation = { path: string; local: boolean }

/** The folder a session's workspace names when it is a repo's own folder (worktree or folder project); null for a team folder. */
export function worktreeOfWorkspace(workspaceId: string): WorktreeLocation | null {
  const hostId = isWorktreeHostIdentity(workspaceId)
    ? getExecutionHostIdFromWorktreeHostIdentity(workspaceId)
    : undefined
  const bareId = normalizeWorkspaceSessionKeyToWorkspaceId(workspaceId)
  const separator = bareId.indexOf(WORKTREE_ID_SEPARATOR)
  const folder = separator > 0 ? bareId.slice(separator + WORKTREE_ID_SEPARATOR.length) : ''
  if (folder === '') {
    return null
  }
  return { path: folder, local: hostId === undefined || hostId === 'local' }
}

/** What a finished task changed in its worktree: the branch it is on, and those files, newest first. */
export type WorktreeChanges = { branch: string; files: string[] }

/**
 * The files a task changed or created in its worktree, committed or not, measured from where its
 * branch began. Null unless this is a linked worktree on a branch that git can read.
 */
export async function readWorktreeChanges(worktreePath: string): Promise<WorktreeChanges | null> {
  // Why: the main checkout's branch began at the repo's first commit, so its diff would list the whole repo.
  if (!isLinkedWorktree(worktreePath)) {
    return null
  }
  try {
    const branch = (await gitOutput(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    if (branch === '' || branch === 'HEAD') {
      return null
    }
    // The branch's reflog begins with the commit it was created from; that is its oldest entry.
    const created = lines(
      await gitOutput(worktreePath, ['log', '-g', '--format=%H', `refs/heads/${branch}`])
    ).at(-1)
    if (created === undefined) {
      return null
    }
    const base = (await gitOutput(worktreePath, ['merge-base', 'HEAD', created])).trim()
    const tracked = await gitOutput(worktreePath, [
      'diff',
      '--name-only',
      '-z',
      '--no-renames',
      base
    ])
    const untracked = await gitOutput(worktreePath, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z'
    ])
    const names = new Set([...splitNul(tracked), ...splitNul(untracked)])
    return { branch, files: newestFirst(worktreePath, [...names]) }
  } catch {
    return null
  }
}

/** Splits the changed files into those copied into the asking team (at most `limit`) and those only linked. */
export function splitWorktreeFiles(
  worktreePath: string,
  files: readonly string[],
  limit: number
): { copy: string[]; linked: string[] } {
  const copy: string[] = []
  const linked: string[] = []
  for (const name of files) {
    if (copy.length < limit && isCopyableFile(path.join(worktreePath, name))) {
      copy.push(name)
    } else {
      linked.push(name)
    }
  }
  return { copy, linked }
}

/** Records the workspace each session ran in, from the host's status feed, for a finish to read. */
export function rememberSessionWorkspaces(
  workspaces: Map<string, string>,
  event: AgentSessionStatusEvent
): void {
  if (event.type === 'snapshot') {
    for (const session of event.sessions) {
      workspaces.set(session.sessionId, session.workspaceId)
    }
  } else if (event.type === 'status') {
    workspaces.set(event.session.sessionId, event.session.workspaceId)
  }
}

/** A linked worktree keeps a `.git` file; the main checkout keeps a `.git` directory. */
function isLinkedWorktree(folder: string): boolean {
  try {
    return lstatSync(path.join(folder, '.git')).isFile()
  } catch {
    return false
  }
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await gitExecFileAsync(args, { cwd })
  return stdout
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function splitNul(text: string): string[] {
  return text.split('\0').filter((name) => name !== '')
}

/** The regular files among `names`, newest first; symbolic links and deleted files are left out. */
function newestFirst(worktreePath: string, names: string[]): string[] {
  const dated: { name: string; mtimeMs: number }[] = []
  for (const name of names) {
    try {
      const stat = lstatSync(path.join(worktreePath, name))
      if (stat.isFile()) {
        dated.push({ name, mtimeMs: stat.mtimeMs })
      }
    } catch {
      // Deleted after it changed: there is nothing to hand over.
    }
  }
  return dated.sort((left, right) => right.mtimeMs - left.mtimeMs).map((file) => file.name)
}
