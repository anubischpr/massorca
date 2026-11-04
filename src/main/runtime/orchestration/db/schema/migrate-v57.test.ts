import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV57 } from './migrate-v57'

const ColumnRows = z.array(z.object({ name: z.string() }))

describe('migrateV57', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A new database already has v57; dropping the two columns gives the v56 shape. */
  function asV56(open: OrchestrationDb): void {
    open.db.exec('ALTER TABLE bot_team_messages DROP COLUMN created_at')
    open.db.exec('ALTER TABLE bot_team_tasks DROP COLUMN created_at')
  }

  function columnNames(open: OrchestrationDb, table: string): string[] {
    return ColumnRows.parse(open.db.prepare(`PRAGMA table_info(${table})`).all()).map(
      (column) => column.name
    )
  }

  function createTeam(open: OrchestrationDb) {
    return open.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
  }

  it('adds created_at to a v56 database and keeps the order of its messages and tasks', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const botId = team.bots[0].id
    asV56(db)
    // Rows as a v56 host wrote them: nothing records a time.
    const insertMessage = db.db.prepare(
      'INSERT INTO bot_team_messages (id, team_id, author_bot_id, author_kind, text) VALUES (?, ?, ?, ?, ?)'
    )
    insertMessage.run('msg-1', team.id, null, null, 'Make the flyer')
    insertMessage.run('msg-2', team.id, botId, null, 'On it')
    insertMessage.run('msg-3', team.id, null, null, 'Thanks')
    const insertTask = db.db.prepare(
      'INSERT INTO bot_team_tasks (id, team_id, title, prompt, owner_bot_id) VALUES (?, ?, ?, ?, ?)'
    )
    insertTask.run('task-1', team.id, 'Flyer', 'Make the flyer', botId)
    insertTask.run('task-2', team.id, 'Notes', 'Written by the bot', botId)
    expect(columnNames(db, 'bot_team_tasks')).not.toContain('created_at')

    migrateV57.call(db, 56)

    expect(columnNames(db, 'bot_team_messages')).toContain('created_at')
    expect(columnNames(db, 'bot_team_tasks')).toContain('created_at')
    const messages = db.listBotTeamMessages(team.id)
    const tasks = db.listBotTeamTasks(team.id)
    expect(messages.map((message) => message.id)).toEqual(['msg-1', 'msg-2', 'msg-3'])
    expect(tasks.map((task) => task.id)).toEqual(['task-1', 'task-2'])
    const messageTimes = messages.map((message) => message.createdAt ?? Number.NaN)
    const taskTimes = tasks.map((task) => task.createdAt ?? Number.NaN)
    expect(messageTimes[0]).toBeLessThan(messageTimes[1])
    expect(messageTimes[1]).toBeLessThan(messageTimes[2])
    expect(taskTimes[0]).toBeLessThan(taskTimes[1])
    // A task of the old rows sits after every message of the old rows, and below any host time.
    expect(Math.min(...taskTimes)).toBeGreaterThan(Math.max(...messageTimes))
    expect(Math.max(...taskTimes)).toBeLessThan(Date.now())
  })

  it('does not fail when the columns are already there, as on a database that restarted from v6', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: team.bots[0].id
    })

    expect(() => migrateV57.call(db!, 56)).not.toThrow()

    expect(columnNames(db, 'bot_team_tasks').filter((name) => name === 'created_at')).toHaveLength(
      1
    )
    // A time the host wrote is kept: only rows without one are backfilled.
    expect(db.getBotTeamTask(task.id).createdAt).toBe(task.createdAt)
  })

  it('does nothing for a database already at v57', () => {
    db = new OrchestrationDb(':memory:')
    asV56(db)
    expect(() => migrateV57.call(db!, 57)).not.toThrow()
    expect(columnNames(db, 'bot_team_tasks')).not.toContain('created_at')
  })
})
