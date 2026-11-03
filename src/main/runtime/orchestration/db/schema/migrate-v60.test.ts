import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV60 } from './migrate-v60'

describe('migrateV60', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function tableNames(open: OrchestrationDb): string[] {
    return (
      open.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string
      }[]
    ).map((row) => row.name)
  }

  it('adds the origin and return tables to a v59 database', () => {
    db = new OrchestrationDb(':memory:')
    db.db.exec('DROP TABLE bot_team_task_origins; DROP TABLE bot_team_returns')

    migrateV60.call(db, 59)

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['bot_team_task_origins', 'bot_team_returns'])
    )
  })

  it('runs twice without failing and keeps what it holds', () => {
    db = new OrchestrationDb(':memory:')
    db.db
      .prepare('INSERT INTO bot_team_task_origins (task_id, origin_team_id) VALUES (?, ?)')
      .run('t1', 'a')

    expect(() => migrateV60.call(db!, 59)).not.toThrow()

    expect(db.db.prepare('SELECT COUNT(*) AS n FROM bot_team_task_origins').get()).toEqual({ n: 1 })
  })

  it('does nothing for a database already at v60', () => {
    db = new OrchestrationDb(':memory:')
    db.db.exec('DROP TABLE bot_team_returns')

    migrateV60.call(db, 60)

    expect(tableNames(db)).not.toContain('bot_team_returns')
  })
})
