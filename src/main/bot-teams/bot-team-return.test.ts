import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { returnFinishedBotTeamTask } from './bot-team-return'

describe('returnFinishedBotTeamTask', () => {
  let db: OrchestrationDb | undefined
  let root = ''
  afterEach(() => {
    db?.close()
    db = undefined
    rmSync(root, { recursive: true, force: true })
  })

  function setup() {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-return-'))
    db = new OrchestrationDb(':memory:')
    const a = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const b = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: b.id,
      title: 'Count boxes',
      prompt: 'Count the flyer boxes',
      ownerBotId: b.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    const asked = db.postBotTeamMessage({
      teamId: a.id,
      text: '@Warehouse count',
      authorBotId: null
    })
    db.setBotTeamTaskOrigin(task.id, a.id, asked.id)
    const folders: Record<string, string> = {
      [a.id]: path.join(root, 'a'),
      [b.id]: path.join(root, 'b')
    }
    mkdirSync(folders[a.id], { recursive: true })
    mkdirSync(folders[b.id], { recursive: true })
    const deps = { folderOf: (teamId: string) => folders[teamId], settleMs: 0 }
    return { db, a, b, task, deps, folders }
  }

  it('posts the bot line and the files it made into the asking room, once', async () => {
    const { db, a, b, task, deps, folders } = setup()
    db.postBotTeamMessage({
      teamId: b.id,
      text: 'Counted 42 boxes, the list is saved.',
      authorBotId: b.bots[0].id
    })
    writeFileSync(path.join(folders[b.id], 'boxes.xlsx'), 'data')
    const old = path.join(folders[b.id], 'old.txt')
    writeFileSync(old, 'x')
    utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1))

    await returnFinishedBotTeamTask(db, 'session-1', deps)
    await returnFinishedBotTeamTask(db, 'session-1', deps)

    const posted = db.listBotTeamMessages(a.id).filter((message) => message.fromTeamId === b.id)
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({
      authorBotId: b.bots[0].id,
      text: 'Counted 42 boxes, the list is saved.',
      attachments: [{ path: 'attachments/from-warehouse-boxes.xlsx', name: 'boxes.xlsx' }]
    })
    expect(
      readFileSync(path.join(folders[a.id], 'attachments', 'from-warehouse-boxes.xlsx'), 'utf8')
    ).toBe('data')
    expect(task.id).toBeTruthy()
  })

  it('says the task finished, in the request language, when the bot left no line', async () => {
    const { db, a, b, deps } = setup()
    db.db.prepare('UPDATE bot_team_tasks SET prompt = ?').run('Cuenta las cajas de los flyers')

    await returnFinishedBotTeamTask(db, 'session-1', deps)

    const posted = db.listBotTeamMessages(a.id).find((message) => message.fromTeamId === b.id)
    expect(posted?.text).toContain('Bea terminó')
  })

  it('does not post again when the bot already wrote in the asking room', async () => {
    const { db, a, b, deps } = setup()
    db.db
      .prepare(
        'INSERT INTO bot_team_messages (id, team_id, author_bot_id, text, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run('m-own', a.id, b.bots[0].id, 'Done, here it is', Date.now())

    await returnFinishedBotTeamTask(db, 'session-1', deps)

    expect(db.listBotTeamMessages(a.id).filter((message) => message.fromTeamId)).toEqual([])
  })

  it('posts once when two finish events overlap during the wait', async () => {
    const { db, a, b, deps } = setup()
    const waiting = { ...deps, settleMs: 20 }

    await Promise.all([
      returnFinishedBotTeamTask(db, 'session-1', waiting),
      returnFinishedBotTeamTask(db, 'session-1', waiting)
    ])

    expect(db.listBotTeamMessages(a.id).filter((m) => m.fromTeamId === b.id)).toHaveLength(1)
  })

  it('still returns when the bot only wrote in the asking room before the task', async () => {
    const { db, a, b, deps } = setup()
    db.db
      .prepare(
        'INSERT INTO bot_team_messages (id, team_id, author_bot_id, text, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run('m-old', a.id, b.bots[0].id, 'An older answer', 1)

    await returnFinishedBotTeamTask(db, 'session-1', deps)

    expect(db.listBotTeamMessages(a.id).filter((m) => m.fromTeamId === b.id)).toHaveLength(1)
  })

  it('ignores a task nobody asked another team for', async () => {
    const { db, a, b, deps } = setup()
    const own = db.createBotTeamTask({
      teamId: a.id,
      title: 'Own',
      prompt: 'Own',
      ownerBotId: a.bots[0].id
    })
    db.setBotTeamTaskSession(own.id, 'session-2')

    await returnFinishedBotTeamTask(db, 'session-2', deps)

    expect(db.listBotTeamMessages(b.id)).toEqual([])
    expect(db.listBotTeamMessages(a.id).filter((message) => message.fromTeamId)).toEqual([])
  })
})
