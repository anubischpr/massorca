import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV58 } from './migrate-v58'

const NameRows = z.array(z.object({ name: z.string() }))

describe('migrateV58', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A new database already has v58; dropping the join table and the column gives the v57 shape. */
  function asV57(open: OrchestrationDb): void {
    open.db.exec('DROP TABLE bot_team_project_teams')
    open.db.exec('ALTER TABLE bot_team_projects DROP COLUMN archived_at')
  }

  const projectColumns = (open: OrchestrationDb): string[] =>
    NameRows.parse(open.db.prepare('PRAGMA table_info(bot_team_projects)').all()).map(
      (column) => column.name
    )

  const tableNames = (open: OrchestrationDb): string[] =>
    NameRows.parse(
      open.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    ).map((table) => table.name)

  function createTeam(open: OrchestrationDb, name: string) {
    return open.createBotTeam({
      name,
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
  }

  it('adds the link table and archived_at to a v57 database and keeps its projects', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db, 'Marketing')
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'NexusCare',
      goal: '',
      codeSource: null
    })
    asV57(db)
    expect(tableNames(db)).not.toContain('bot_team_project_teams')

    migrateV58.call(db, 57)

    expect(tableNames(db)).toContain('bot_team_project_teams')
    expect(projectColumns(db)).toContain('archived_at')
    expect(db.getBotTeamProject(project.id)).toMatchObject({ name: 'NexusCare', archivedAt: null })
  })

  it('does not fail when the column is already there, as on a database that restarted from v6', () => {
    db = new OrchestrationDb(':memory:')
    expect(() => migrateV58.call(db!, 57)).not.toThrow()
    expect(projectColumns(db).filter((name) => name === 'archived_at')).toHaveLength(1)
  })

  it('does nothing for a database already at v58', () => {
    db = new OrchestrationDb(':memory:')
    asV57(db)
    expect(() => migrateV58.call(db!, 58)).not.toThrow()
    expect(tableNames(db)).not.toContain('bot_team_project_teams')
  })
})
