import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitExecFileSync } from '../git/command-runner/git-exec-file'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { returnFinishedBotTeamTask } from './bot-team-return'

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

describe('returnFinishedBotTeamTask for a task that ran in a linked worktree', () => {
  let db: OrchestrationDb | undefined
  let root = ''
  afterEach(() => {
    db?.close()
    db = undefined
    rmSync(root, { recursive: true, force: true })
  })

  function setup() {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-return-worktree-'))
    db = new OrchestrationDb(':memory:')
    const asking = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const owning = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: owning.id,
      title: 'Count boxes',
      prompt: 'Count the flyer boxes',
      ownerBotId: owning.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    const asked = db.postBotTeamMessage({
      teamId: asking.id,
      text: '@Warehouse count',
      authorBotId: null
    })
    db.setBotTeamTaskOrigin(task.id, asking.id, asked.id)
    const folders: Record<string, string> = {
      [asking.id]: path.join(root, 'a'),
      [owning.id]: path.join(root, 'b')
    }
    mkdirSync(folders[asking.id], { recursive: true })
    mkdirSync(folders[owning.id], { recursive: true })
    const deps = { folderOf: (teamId: string) => folders[teamId], settleMs: 0 }
    return { db, asking, owning, deps, folders }
  }

  /** A repo with one commit, and a linked worktree on a branch that starts there. */
  function linkedWorktree(): string {
    const repo = path.join(root, 'repo')
    mkdirSync(repo)
    git(repo, 'init', '-q')
    writeFileSync(path.join(repo, 'README.md'), 'readme')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'base')
    const worktree = path.join(root, 'wt')
    git(repo, 'worktree', 'add', '-q', '-b', 'delegated/count', worktree, 'HEAD')
    return worktree
  }

  it('copies the text files a linked worktree changed, and names its branch, folder and the files it did not copy', async () => {
    const { db, asking, owning, deps } = setup()
    const worktree = linkedWorktree()
    writeFileSync(path.join(worktree, 'summary.md'), 'Counted 42')
    writeFileSync(path.join(worktree, 'boxes.xlsx'), 'PK\u0000\u0003binary')
    writeFileSync(path.join(worktree, 'video.bin'), Buffer.alloc(26 * 1024 * 1024, 1))

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `repo-1::${worktree}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.attachments).toEqual([
      { path: 'attachments/from-warehouse-summary.md', name: 'summary.md' }
    ])
    expect(posted?.text).toContain('Bea finished "Count boxes".')
    expect(posted?.text).toContain('delegated/count')
    expect(posted?.text).toContain(worktree)
    expect(posted?.text).toContain('boxes.xlsx')
    expect(posted?.text).toContain('video.bin')
  })

  it('copies at most ten worktree files, newest first, and names the rest', async () => {
    const { db, asking, owning, deps } = setup()
    const worktree = linkedWorktree()
    for (let n = 1; n <= 12; n += 1) {
      const name = `note-${String(n).padStart(2, '0')}.txt`
      const file = path.join(worktree, name)
      writeFileSync(file, 'x')
      const at = new Date(Date.UTC(2026, 0, 1, 0, 0, n))
      utimesSync(file, at, at)
    }

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `repo-1::${worktree}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.attachments).toHaveLength(10)
    expect((posted?.attachments ?? []).map((file) => file.name)).not.toContain('note-01.txt')
    expect(posted?.text).toContain('note-01.txt')
    expect(posted?.text).toContain('note-02.txt')
  })

  it('posts the finish line and no files when a git worktree cannot be read, without listing its folder', async () => {
    const { db, asking, owning, deps } = setup()
    const folder = path.join(root, 'broken')
    mkdirSync(folder)
    writeFileSync(path.join(folder, '.git'), 'gitdir: nowhere')
    writeFileSync(path.join(folder, 'everything.txt'), 'x')

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `repo-1::${folder}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.text).toContain('Bea finished "Count boxes".')
    expect(posted?.text).toContain(folder)
    expect(posted?.attachments ?? []).toEqual([])
  })

  it('links the main checkout a read-only task ran in, and copies nothing from its history', async () => {
    const { db, asking, owning, deps } = setup()
    const repo = path.join(root, 'repo')
    mkdirSync(repo)
    git(repo, 'init', '-q')
    writeFileSync(path.join(repo, 'README.md'), 'readme')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'base')
    writeFileSync(path.join(repo, 'README.md'), 'edited by the person')
    writeFileSync(path.join(repo, 'scratch.txt'), 'the person’s own file')

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `repo-1::${repo}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.attachments ?? []).toEqual([])
    expect(posted?.text).toContain(repo)
  })

  it('copies the files a folder project that is not a git checkout gained since the task began', async () => {
    const { db, asking, owning, deps } = setup()
    const folder = path.join(root, 'project')
    mkdirSync(folder)
    writeFileSync(path.join(folder, 'report.md'), 'written by the bot')

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `repo-1::${folder}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.attachments).toEqual([
      { path: 'attachments/from-warehouse-report.md', name: 'report.md' }
    ])
    expect(posted?.text).toContain(folder)
  })

  it('links a worktree on another host and copies nothing from it', async () => {
    const { db, asking, owning, deps } = setup()

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: 'ssh:box|repo-1::/srv/wt'
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.text).toContain('/srv/wt')
    expect(posted?.attachments ?? []).toEqual([])
  })

  it('keeps copying what the bot wrote in the team folder when the session ran outside a worktree', async () => {
    const { db, asking, owning, deps, folders } = setup()
    writeFileSync(path.join(folders[owning.id], 'boxes.xlsx'), 'data')

    await returnFinishedBotTeamTask(db, 'session-1', {
      ...deps,
      sessionWorkspaceId: `folder:${owning.id}`
    })

    const posted = db.listBotTeamMessages(asking.id).find((m) => m.fromTeamId === owning.id)
    expect(posted?.attachments).toEqual([
      { path: 'attachments/from-warehouse-boxes.xlsx', name: 'boxes.xlsx' }
    ])
  })
})
