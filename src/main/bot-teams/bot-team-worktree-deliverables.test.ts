import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSessionStatusEvent } from '../../shared/agent-session-wire'
import { gitExecFileSync } from '../git/command-runner/git-exec-file'
import { MAX_FILE_BYTES } from './bot-team-deliverables'
import { isCopyableFile } from './bot-team-deliverables-copyable'
import {
  readWorktreeChanges,
  rememberSessionWorkspaces,
  worktreeOfWorkspace
} from './bot-team-worktree-deliverables'

function git(cwd: string, ...args: string[]): string {
  return gitExecFileSync(
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args
    ],
    { cwd, encoding: 'utf8' }
  )
}

describe('readWorktreeChanges', () => {
  let root = ''
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  /** A repo with one commit, and a linked worktree on a new branch that starts there. */
  function linkedWorktree(): string {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-worktree-'))
    const repo = path.join(root, 'repo')
    mkdirSync(repo)
    git(repo, 'init', '-q')
    writeFileSync(path.join(repo, 'README.md'), 'readme')
    writeFileSync(path.join(repo, 'notes.txt'), 'old notes')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'base')
    const worktree = path.join(root, 'wt')
    git(repo, 'worktree', 'add', '-q', '-b', 'delegated/count', worktree, 'HEAD')
    return worktree
  }

  it('lists the files a task changed or created, committed or not, and not the ones it left alone', async () => {
    const worktree = linkedWorktree()
    writeFileSync(path.join(worktree, 'notes.txt'), 'new notes')
    writeFileSync(path.join(worktree, 'summary.md'), 'summary')
    git(worktree, 'add', 'summary.md')
    git(worktree, 'commit', '-q', '-m', 'summary')
    writeFileSync(path.join(worktree, 'draft.txt'), 'untracked')

    const changes = await readWorktreeChanges(worktree)

    expect(changes?.branch).toBe('delegated/count')
    expect(new Set(changes?.files)).toEqual(new Set(['notes.txt', 'summary.md', 'draft.txt']))
  })

  it('returns nothing for a folder that is not a git worktree', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-worktree-'))
    writeFileSync(path.join(root, 'plain.txt'), 'x')

    expect(await readWorktreeChanges(root)).toBeNull()
  })

  it('returns nothing for a path this host cannot read', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-worktree-'))

    expect(await readWorktreeChanges(path.join(root, 'missing'))).toBeNull()
  })
})

describe('worktreeOfWorkspace', () => {
  it('reads the path of a worktree on this host, bare or as a session key', () => {
    expect(worktreeOfWorkspace('repo-1::/work/a')).toEqual({ path: '/work/a', local: true })
    expect(worktreeOfWorkspace('worktree:repo-1::/work/a')).toEqual({
      path: '/work/a',
      local: true
    })
    expect(worktreeOfWorkspace('|repo-1::/work/a')).toEqual({ path: '/work/a', local: true })
  })

  it('marks a worktree on another host as not readable here, and gives nothing for a team folder', () => {
    expect(worktreeOfWorkspace('ssh:box|repo-1::/srv/a')).toEqual({ path: '/srv/a', local: false })
    expect(worktreeOfWorkspace('folder:f1')).toBeNull()
  })
})

describe('rememberSessionWorkspaces', () => {
  function summary(sessionId: string, workspaceId: string) {
    return {
      sessionId,
      workspaceId,
      agent: 'claude' as const,
      status: 'idle' as const,
      latestPrompt: '',
      updatedAt: 1
    }
  }

  it('keeps the workspace each session ran in, from the opening snapshot and from live changes', () => {
    const workspaces = new Map<string, string>()
    const snapshot: AgentSessionStatusEvent = {
      type: 'snapshot',
      sessions: [summary('s1', 'repo-1::/work/a')]
    }
    rememberSessionWorkspaces(workspaces, snapshot)
    rememberSessionWorkspaces(workspaces, {
      type: 'status',
      session: summary('s2', 'folder:f1')
    })

    expect(workspaces.get('s1')).toBe('repo-1::/work/a')
    expect(workspaces.get('s2')).toBe('folder:f1')
  })
})

describe('isCopyableFile', () => {
  let root = ''
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('copies a text file and a binary one, but not a file that is not there', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-copyable-'))
    writeFileSync(path.join(root, 'notes.md'), 'plain text')
    writeFileSync(path.join(root, 'deck.pdf'), 'PK\u0000\u0003binary')

    expect(isCopyableFile(path.join(root, 'notes.md'))).toBe(true)
    expect(isCopyableFile(path.join(root, 'deck.pdf'))).toBe(true)
    expect(isCopyableFile(path.join(root, 'absent.md'))).toBe(false)
  })

  it('refuses a file over the size limit, binary or not', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-copyable-'))
    writeFileSync(path.join(root, 'big.bin'), Buffer.alloc(MAX_FILE_BYTES + 1))

    expect(isCopyableFile(path.join(root, 'big.bin'))).toBe(false)
  })
})
