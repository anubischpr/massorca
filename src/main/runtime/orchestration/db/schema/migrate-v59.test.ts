import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV59 } from './migrate-v59'

const ColumnRows = z.array(z.object({ name: z.string() }))

describe('migrateV59', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A new database already has v59; dropping the column gives the v58 shape. */
  function asV58(open: OrchestrationDb): void {
    open.db.exec('ALTER TABLE bot_team_tasks DROP COLUMN last_status')
  }

  function columnNames(open: OrchestrationDb, table: string): string[] {
    return ColumnRows.parse(open.db.prepare(`PRAGMA table_info(${table})`).all()).map(
      (column) => column.name
    )
  }

  function createTaskOf(open: OrchestrationDb) {
    const team = open.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    return open.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: team.bots[0].id
    })
  }

  it('adds last_status to a v58 database and keeps its tasks', () => {
    db = new OrchestrationDb(':memory:')
    const task = createTaskOf(db)
    asV58(db)
    expect(columnNames(db, 'bot_team_tasks')).not.toContain('last_status')

    migrateV59.call(db, 58)

    expect(columnNames(db, 'bot_team_tasks')).toContain('last_status')
    expect(db.getBotTeamTask(task.id).title).toBe('Flyer')
  })

  it('does not fail when the column is already there, as on a database that restarted from an older schema', () => {
    db = new OrchestrationDb(':memory:')

    expect(() => migrateV59.call(db!, 58)).not.toThrow()

    expect(columnNames(db, 'bot_team_tasks').filter((name) => name === 'last_status')).toHaveLength(
      1
    )
  })

  it('does nothing for a database already at v59', () => {
    db = new OrchestrationDb(':memory:')
    asV58(db)

    expect(() => migrateV59.call(db!, 59)).not.toThrow()

    expect(columnNames(db, 'bot_team_tasks')).not.toContain('last_status')
  })
})
