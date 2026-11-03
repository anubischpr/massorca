import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV56 } from './migrate-v56'

const ColumnRows = z.array(z.object({ name: z.string() }))

describe('migrateV56', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A new database already has v56; dropping its columns gives the v55 shape. */
  function asV55(open: OrchestrationDb): void {
    open.db.exec('ALTER TABLE bot_team_projects DROP COLUMN workspace_key')
    open.db.exec('ALTER TABLE bot_team_projects DROP COLUMN workspace_name')
  }

  function columnNames(open: OrchestrationDb): string[] {
    return ColumnRows.parse(open.db.prepare('PRAGMA table_info(bot_team_projects)').all()).map(
      (column) => column.name
    )
  }

  it('adds the workspace columns to a v55 database and keeps its projects', () => {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: true,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    asV55(db)
    db.db
      .prepare('INSERT INTO bot_team_projects (id, team_id, name, goal) VALUES (?, ?, ?, ?)')
      .run('project-1', team.id, 'Summer', 'Sell')
    expect(columnNames(db)).not.toContain('workspace_key')

    migrateV56.call(db, 55)

    expect(columnNames(db)).toEqual(expect.arrayContaining(['workspace_key', 'workspace_name']))
    expect(
      db.db
        .prepare(
          'SELECT id, name, goal, workspace_key AS workspaceKey, workspace_name AS workspaceName FROM bot_team_projects'
        )
        .all()
    ).toEqual([
      { id: 'project-1', name: 'Summer', goal: 'Sell', workspaceKey: null, workspaceName: null }
    ])
  })

  it('does not fail when the columns are already there, as on a database that restarted from v6', () => {
    db = new OrchestrationDb(':memory:')
    migrateV56.call(db, 55)

    expect(() => migrateV56.call(db!, 55)).not.toThrow()
    expect(columnNames(db).filter((name) => name === 'workspace_key')).toHaveLength(1)
  })

  it('does nothing for a database already at v56', () => {
    db = new OrchestrationDb(':memory:')
    asV55(db)
    expect(() => migrateV56.call(db!, 56)).not.toThrow()
    expect(columnNames(db)).not.toContain('workspace_key')
  })
})
