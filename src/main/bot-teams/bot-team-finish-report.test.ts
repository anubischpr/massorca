import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

  function setup(prompt = 'Prepara el informe') {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-report-'))
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
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
})
