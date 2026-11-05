import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitExecFileSync } from '../git/command-runner/git-exec-file'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { reportFinishedBotTeamTask } from './bot-team-finish-report'

/** Two hours before now: older than any task the tests start, so no list shows the file. */
const LONG_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000)

/** Whether this machine lets a folder junction be made without elevated rights. */
function canLinkFolder(): boolean {
  const dir = mkdtempSync(path.join(tmpdir(), 'bot-team-link-'))
  try {
    mkdirSync(path.join(dir, 'target'))
    symlinkSync(path.join(dir, 'target'), path.join(dir, 'link'), 'junction')
    return true
  } catch {
    return false
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

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
    { cwd, encoding: 'utf8', timeout: 60_000 }
  )
}

describe('reportFinishedBotTeamTask', () => {
  let db: OrchestrationDb | undefined
  let root = ''
  afterEach(() => {
    db?.close()
    db = undefined
    rmSync(root, { recursive: true, force: true })
  })

  function setup(prompt = 'Prepara el informe', workspacesEnabled = false) {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-report-'))
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Informe',
      prompt,
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    const folder = path.join(root, team.id)
    mkdirSync(folder, { recursive: true })
    return { team, task, folder }
  }

  const run = (folder: string) =>
    reportFinishedBotTeamTask(db!, 'session-1', { folderOf: () => folder, settleMs: 0 })

  it('tells the room where the deliverable is when the bot did not', async () => {
    const { team, folder } = setup()
    writeFileSync(path.join(folder, 'informe.pdf'), 'x')
    await run(folder)
    const posted = db!.listBotTeamMessages(team.id)
    expect(posted).toHaveLength(1)
    expect(posted[0].text).toContain('Entregable de "Informe"')
    expect(posted[0].text).toContain('informe.pdf')
  })

  it('adds nothing when the bot already named the file', async () => {
    const { team, task, folder } = setup()
    writeFileSync(path.join(folder, 'informe.pdf'), 'x')
    db!.postBotTeamMessage({
      teamId: team.id,
      authorBotId: task.ownerBotId,
      text: 'Listo: informe.pdf'
    })
    await run(folder)
    expect(db!.listBotTeamMessages(team.id)).toHaveLength(1)
  })

  it('adds nothing for a task that made no file', async () => {
    const { team, folder } = setup()
    await run(folder)
    expect(db!.listBotTeamMessages(team.id)).toHaveLength(0)
  })

  describe('a team with Workspaces', { timeout: 120_000 }, () => {
    function worktreeRun(folder: string, worktree: string, files: string[]) {
      return reportFinishedBotTeamTask(db!, 'session-1', {
        folderOf: () => folder,
        settleMs: 0,
        sessionWorkspaceId: 'ws-1',
        worktreeOf: () => ({ path: worktree, local: true }),
        changesOf: async () => ({ branch: 'iris/informe', files })
      })
    }

    /** A folder project that is not a git checkout: nothing lists its files but their times. */
    function folderRun(folder: string, project: string) {
      return reportFinishedBotTeamTask(db!, 'session-1', {
        folderOf: () => folder,
        settleMs: 0,
        sessionWorkspaceId: 'ws-1',
        worktreeOf: () => ({ path: project, local: true }),
        changesOf: async () => null
      })
    }

    /** A repo with one commit that ignores `docs/`, and a linked worktree on a new branch. */
    function linkedWorktree(): string {
      const repo = path.join(root, 'repo')
      mkdirSync(repo)
      git(repo, 'init', '-q')
      writeFileSync(path.join(repo, '.gitignore'), 'docs/\n')
      writeFileSync(path.join(repo, 'notes.txt'), 'old notes')
      git(repo, 'add', '.')
      git(repo, 'commit', '-q', '-m', 'base')
      const worktree = path.join(root, 'worktree')
      git(repo, 'worktree', 'add', '-q', '-b', 'iris/informe', worktree, 'HEAD')
      return worktree
    }

    function lastPosted(teamId: string) {
      return db!.listBotTeamMessages(teamId).at(-1)
    }

    it('attaches the files the task made to the bot message, as chips (pv84 QA)', async () => {
      const { team, folder } = setup('Prepara el informe', true)
      const worktree = path.join(root, 'worktree')
      mkdirSync(path.join(worktree, 'docs'), { recursive: true })
      writeFileSync(path.join(worktree, 'docs', 'impacto.html'), '<p>x</p>')
      writeFileSync(path.join(worktree, 'informe.md'), '# x')
      await worktreeRun(folder, worktree, ['docs/impacto.html', 'informe.md'])
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted).toHaveLength(1)
      expect(posted[0].attachments?.map((file) => file.name)).toEqual([
        'impacto.html',
        'informe.md'
      ])
      expect(posted[0].text).not.toContain(worktree)
      // The copies sit in the team folder, so the room's Files lists them.
      for (const file of posted[0].attachments ?? []) {
        expect(readFileSync(path.join(folder, file.path), 'utf8').length).toBeGreaterThan(0)
      }
    })

    it('attaches them even when the bot already named the files in its own words', async () => {
      const { team, task, folder } = setup('Prepara el informe', true)
      const worktree = path.join(root, 'worktree')
      mkdirSync(worktree, { recursive: true })
      writeFileSync(path.join(worktree, 'informe.md'), '# x')
      db!.postBotTeamMessage({
        teamId: team.id,
        authorBotId: task.ownerBotId,
        text: 'Listo: informe.md'
      })
      await worktreeRun(folder, worktree, ['informe.md'])
      await worktreeRun(folder, worktree, ['informe.md'])
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted).toHaveLength(2)
      expect(posted[1].attachments?.map((file) => file.name)).toEqual(['informe.md'])
    })

    it('keeps the text line for a team without Workspaces', async () => {
      const { team, folder } = setup()
      const worktree = path.join(root, 'worktree')
      mkdirSync(worktree, { recursive: true })
      writeFileSync(path.join(worktree, 'informe.md'), '# x')
      await worktreeRun(folder, worktree, ['informe.md'])
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted[0].attachments ?? []).toEqual([])
      expect(posted[0].text).toContain('Entregable de "Informe"')
    })

    it('attaches a deliverable the bot kept in a git-ignored folder of its worktree', async () => {
      const { team, folder } = setup('Prepara el informe', true)
      const worktree = linkedWorktree()
      mkdirSync(path.join(worktree, 'docs'))
      writeFileSync(path.join(worktree, 'docs', 'impacto.html'), '<p>x</p>')
      // Git does not list the file, which is why the room only got the path before.
      expect(git(worktree, 'ls-files', '--others', '--exclude-standard')).not.toContain(
        'impacto.html'
      )
      await reportFinishedBotTeamTask(db!, 'session-1', {
        folderOf: () => folder,
        settleMs: 0,
        sessionWorkspaceId: 'ws-1',
        worktreeOf: () => ({ path: worktree, local: true })
      })
      expect(lastPosted(team.id)?.attachments?.map((file) => file.name)).toEqual(['impacto.html'])
    })

    it('attaches an ignored deliverable in a folder project that is not a git checkout', async () => {
      const { team, folder } = setup('Prepara el informe', true)
      const project = path.join(root, 'project')
      mkdirSync(path.join(project, 'docs'), { recursive: true })
      writeFileSync(path.join(project, 'docs', 'impacto.html'), '<p>x</p>')
      await folderRun(folder, project)
      expect(lastPosted(team.id)?.attachments?.map((file) => file.name)).toEqual(['impacto.html'])
    })

    it('attaches a file the bot names by absolute path, even when no list shows it', async () => {
      const { team, task, folder } = setup('Prepara el informe', true)
      const project = path.join(root, 'project')
      mkdirSync(project, { recursive: true })
      const guide = path.join(project, 'guia.md')
      writeFileSync(guide, '# guia')
      utimesSync(guide, LONG_AGO, LONG_AGO)
      db!.postBotTeamMessage({
        teamId: team.id,
        authorBotId: task.ownerBotId,
        text: `Listo: ${guide}`
      })
      await folderRun(folder, project)
      expect(lastPosted(team.id)?.attachments?.map((file) => file.name)).toEqual(['guia.md'])
    })

    it('refuses an absolute path outside the task folders and the team folder', async () => {
      const { team, task, folder } = setup('Prepara el informe', true)
      const project = path.join(root, 'project')
      mkdirSync(project, { recursive: true })
      const outside = path.join(root, 'outside')
      mkdirSync(outside)
      const secret = path.join(outside, 'secreto.txt')
      writeFileSync(secret, 'x')
      db!.postBotTeamMessage({
        teamId: team.id,
        authorBotId: task.ownerBotId,
        text: `Listo: ${secret}`
      })
      await folderRun(folder, project)
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted.flatMap((message) => message.attachments ?? [])).toEqual([])
      expect(existsSync(path.join(folder, 'attachments'))).toBe(false)
      expect(lastPosted(team.id)?.text).not.toContain('secreto.txt')
    })

    it.skipIf(!canLinkFolder())(
      'refuses a path that reaches outside the task folder through a linked folder',
      async () => {
        const { team, task, folder } = setup('Prepara el informe', true)
        const project = path.join(root, 'project')
        mkdirSync(project, { recursive: true })
        const outside = path.join(root, 'outside')
        mkdirSync(outside)
        writeFileSync(path.join(outside, 'secreto.txt'), 'x')
        symlinkSync(outside, path.join(project, 'enlace'), 'junction')
        db!.postBotTeamMessage({
          teamId: team.id,
          authorBotId: task.ownerBotId,
          text: `Listo: ${path.join(project, 'enlace', 'secreto.txt')}`
        })
        await folderRun(folder, project)
        expect(db!.listBotTeamMessages(team.id).flatMap((m) => m.attachments ?? [])).toEqual([])
      }
    )

    it('keeps the tracked and untracked deliverables git lists, and leaves out an older ignored file', async () => {
      const { team, folder } = setup('Prepara el informe', true)
      const worktree = linkedWorktree()
      writeFileSync(path.join(worktree, 'notes.txt'), 'new notes')
      git(worktree, 'add', 'notes.txt')
      git(worktree, 'commit', '-q', '-m', 'notes')
      writeFileSync(path.join(worktree, 'draft.md'), '# draft')
      mkdirSync(path.join(worktree, 'docs'))
      const older = path.join(worktree, 'docs', 'antiguo.html')
      writeFileSync(older, '<p>old</p>')
      utimesSync(older, LONG_AGO, LONG_AGO)
      await reportFinishedBotTeamTask(db!, 'session-1', {
        folderOf: () => folder,
        settleMs: 0,
        sessionWorkspaceId: 'ws-1',
        worktreeOf: () => ({ path: worktree, local: true })
      })
      expect(
        lastPosted(team.id)
          ?.attachments?.map((file) => file.name)
          .sort()
      ).toEqual(['draft.md', 'notes.txt'])
    })

    it('still tells the room about a deliverable that cannot be copied into Files', async () => {
      const { team, folder } = setup('Prepara el informe', true)
      const worktree = path.join(root, 'worktree')
      mkdirSync(worktree, { recursive: true })
      writeFileSync(path.join(worktree, 'informe.md'), '# x')
      // Nothing can be copied while the attachments folder is a plain file.
      writeFileSync(path.join(folder, 'attachments'), 'not a folder')
      await worktreeRun(folder, worktree, ['informe.md'])
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted).toHaveLength(1)
      expect(posted[0].text).toContain('informe.md')
    })
  })
})
