import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV61 } from './migrate-v61'

describe('migrateV61', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  const columns = (open: OrchestrationDb): string[] =>
    (open.db.pragma('table_info(bot_team_routines)') as { name: string }[]).map((row) => row.name)

  it('adds the one-time date to a v60 database and keeps its routines', () => {
    db = new OrchestrationDb(':memory:')
    db.db.exec(
      'ALTER TABLE bot_team_routines DROP COLUMN run_date; ALTER TABLE bot_team_routines DROP COLUMN time_zone'
    )
    db.db
      .prepare(
        `INSERT INTO bot_team_routines (id, team_id, bot_id, name, prompt, frequency, time_of_day, created_at)
         VALUES ('r1', 't1', 'b1', 'Daily', 'x', 'daily', '09:00', 0)`
      )
      .run()

    migrateV61.call(db, 60)

    expect(columns(db)).toEqual(expect.arrayContaining(['run_date', 'time_zone']))
    expect(db.db.prepare('SELECT run_date, time_zone FROM bot_team_routines').get()).toEqual({
      run_date: null,
      time_zone: null
    })
  })

  it('runs twice without failing', () => {
    db = new OrchestrationDb(':memory:')
    expect(() => migrateV61.call(db!, 60)).not.toThrow()
    expect(columns(db)).toContain('run_date')
  })
})
