import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { reportFinishedBotTeamTask } from './bot-team-finish-report'

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

  describe('a team with Workspaces', () => {
    function worktreeRun(folder: string, worktree: string, files: string[]) {
      return reportFinishedBotTeamTask(db!, 'session-1', {
        folderOf: () => folder,
        settleMs: 0,
        sessionWorkspaceId: 'ws-1',
        worktreeOf: () => ({ path: worktree, local: true }),
        changesOf: async () => ({ branch: 'iris/informe', files })
      })
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
  })
})
