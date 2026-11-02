import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../contract-constants'
import { OrchestrationDb } from '../orchestration-db'

describe('upgrading a database from before routines and web addresses', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('adds the tables and keeps the teams that were already there', () => {
    dir = mkdtempSync(join(tmpdir(), 'orchestration-upgrade-'))
    const path = join(dir, 'orchestration.db')
    const before = new OrchestrationDb(path)
    const team = before.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: '', agent: 'claude' }]
    })
    // Put the file back the way v53 left it.
    before.db.exec(`
      DROP TABLE bot_team_routine_runs;
      DROP TABLE bot_team_routines;
      DROP TABLE bot_team_webhooks;
      PRAGMA user_version = 53;
    `)
    before.close()

    const after = new OrchestrationDb(path)
    try {
      const tables = after.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'bot_team_%'")
        .all()
        .map((row) => String(row.name))
      expect(tables).toEqual(
        expect.arrayContaining(['bot_team_routines', 'bot_team_routine_runs', 'bot_team_webhooks'])
      )
      expect(after.db.prepare('PRAGMA user_version').get()).toEqual({
        user_version: SCHEMA_VERSION
      })
      expect(after.listBotTeams().map((entry) => entry.id)).toEqual([team.id])
    } finally {
      after.close()
    }
  })
})
