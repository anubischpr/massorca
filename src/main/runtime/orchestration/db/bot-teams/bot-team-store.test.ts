import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { SCHEMA_VERSION } from '../contract-constants'

const IRIS = { name: 'Iris', job: 'Designs flyers', agent: 'claude' as 'claude' | 'codex' }

describe('bot team store', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function createTeam(open: OrchestrationDb, bots = [IRIS]) {
    return open.createBotTeam({
      name: 'Marketing',
      purpose: 'Flyers',
      character: 'circle',
      workspacesEnabled: false,
      bots
    })
  }

  it('creates a team with its bots and full access by default', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)

    expect(team).toMatchObject({
      name: 'Marketing',
      purpose: 'Flyers',
      character: 'circle',
      workspacesEnabled: false,
      accessMode: 'full-access'
    })
    expect(team.bots).toEqual([
      {
        id: expect.any(String),
        ...IRIS,
        modelMode: 'auto',
        model: 'sonnet',
        effort: 'high',
        skills: []
      }
    ])
    expect(db.listBotTeams()).toEqual([team])
  })

  it('stores a chosen model and skills, and keeps them across a plain edit', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const botId = team.bots[0].id
    db.updateBotOnTeam(team.id, botId, {
      ...IRIS,
      modelMode: 'manual',
      model: 'opus',
      effort: 'high',
      skills: ['PDF']
    })
    const edited = db.updateBotOnTeam(team.id, botId, { ...IRIS, name: 'Iris 2' })

    expect(edited.bots[0]).toMatchObject({
      name: 'Iris 2',
      modelMode: 'manual',
      model: 'opus',
      effort: 'high',
      skills: ['PDF']
    })
  })

  it('picks a model for a bot stored before models were chosen', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    db.db.prepare('UPDATE bot_team_bots SET model = NULL, effort = NULL').run()

    expect(db.listBotTeams()[0].bots[0]).toMatchObject({ id: team.bots[0].id, model: 'sonnet' })
  })

  it('lists teams and bots in creation order', () => {
    db = new OrchestrationDb(':memory:')
    const first = createTeam(db, [IRIS, { name: 'Max', job: '', agent: 'codex' }])
    const second = db.createBotTeam({
      name: 'Sales',
      purpose: '',
      character: 'square',
      workspacesEnabled: true,
      bots: []
    })

    const listed = db.listBotTeams()
    expect(listed.map((team) => team.id)).toEqual([first.id, second.id])
    expect(listed[0].bots.map((bot) => bot.name)).toEqual(['Iris', 'Max'])
    expect(listed[1].workspacesEnabled).toBe(true)
  })

  it('changes only the fields an update names', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)

    const updated = db.updateBotTeam({ teamId: team.id, accessMode: 'default' })
    expect(updated).toEqual({ ...team, accessMode: 'default' })
    expect(db.updateBotTeam({ teamId: team.id, workspacesEnabled: true })).toEqual({
      ...team,
      accessMode: 'default',
      workspacesEnabled: true
    })
  })

  it('adds and removes a bot on an existing team', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db, [])

    const added = db.addBotToTeam(team.id, IRIS)
    expect(added.bots.map((bot) => bot.name)).toEqual(['Iris'])
    expect(db.removeBotFromTeam(team.id, added.bots[0].id).bots).toEqual([])
  })

  it('updates every attribute of a bot and keeps its id', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const botId = team.bots[0].id

    const updated = db.updateBotOnTeam(team.id, botId, {
      name: 'Juan',
      job: 'Backend',
      agent: 'codex'
    })

    expect(updated.bots).toMatchObject([
      { id: botId, name: 'Juan', job: 'Backend', agent: 'codex' }
    ])
    expect(db.listBotTeams()[0].bots[0].name).toBe('Juan')
  })

  it('refuses to update a bot through another team', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const other = createTeam(db, [])

    expect(() =>
      db?.updateBotOnTeam(other.id, team.bots[0].id, { name: 'X', job: '', agent: 'codex' })
    ).toThrow('is not on team')
    expect(db.listBotTeams()[0].bots[0].name).toBe('Iris')
  })

  it('removes a team together with its bots', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)

    db.deleteBotTeam(team.id)
    expect(db.listBotTeams()).toEqual([])
    const orphans = db.db.prepare('SELECT COUNT(*) AS n FROM bot_team_bots').get()
    expect(orphans).toEqual({ n: 0 })
  })

  it('refuses a change to a team that does not exist', () => {
    db = new OrchestrationDb(':memory:')

    expect(() => db?.updateBotTeam({ teamId: 'nope', accessMode: 'default' })).toThrow(
      'Bot team nope was not found.'
    )
    expect(() => db?.addBotToTeam('nope', IRIS)).toThrow('Bot team nope was not found.')
  })

  it('adds the tables to a database from the previous version and keeps its rows', () => {
    db = new OrchestrationDb(':memory:')
    db.db.exec('DROP TABLE bot_team_bots; DROP TABLE bot_teams;')
    db.db.pragma('user_version = 43')

    db.migrate()

    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.listBotTeams()).toEqual([])
    expect(createTeam(db).accessMode).toBe('full-access')
  })
})
