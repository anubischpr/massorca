import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../contract-constants'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team memory store', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Iris', job: 'Designs flyers', agent: 'claude' },
        { name: 'Nora', job: 'Writes', agent: 'claude' }
      ]
    })
    return { db, team }
  }

  it('keeps what the team and a bot remember, with where each line came from', () => {
    const { db, team } = setup()
    const [iris] = team.bots
    db.addBotTeamMemory({
      teamId: team.id,
      botId: null,
      text: 'Offices are closed on Monday.',
      source: { kind: 'task', taskTitle: 'Flyer for June' }
    })
    db.addBotTeamMemory({
      teamId: team.id,
      botId: iris.id,
      text: 'Large photo at the top.',
      source: { kind: 'person', taskTitle: null }
    })
    expect(db.listBotTeamMemory(team.id)).toEqual([
      expect.objectContaining({
        botId: null,
        text: 'Offices are closed on Monday.',
        source: { kind: 'task', taskTitle: 'Flyer for June' }
      }),
      expect.objectContaining({
        botId: iris.id,
        text: 'Large photo at the top.',
        source: { kind: 'person', taskTitle: null }
      })
    ])
  })

  it('trims what it keeps, and refuses an empty line and a bot of another team', () => {
    const { db, team } = setup()
    const added = db.addBotTeamMemory({
      teamId: team.id,
      botId: null,
      text: '  Prices are checked first.  ',
      source: { kind: 'person', taskTitle: null }
    })
    expect(added.text).toBe('Prices are checked first.')
    expect(() =>
      db.addBotTeamMemory({ teamId: team.id, botId: null, text: '  ', source: added.source })
    ).toThrow('Nothing to remember.')
    expect(() =>
      db.addBotTeamMemory({ teamId: team.id, botId: 'ghost', text: 'x', source: added.source })
    ).toThrow('Bot ghost is not on team')
    expect(db.listBotTeamMemory(team.id)).toHaveLength(1)
  })

  it('forgets a line when the person deletes it, and only that line', () => {
    const { db, team } = setup()
    const source = { kind: 'person' as const, taskTitle: null }
    const keep = db.addBotTeamMemory({ teamId: team.id, botId: null, text: 'Keep', source })
    const drop = db.addBotTeamMemory({ teamId: team.id, botId: null, text: 'Drop', source })
    expect(db.deleteBotTeamMemory(drop.id)).toBe(true)
    expect(db.deleteBotTeamMemory(drop.id)).toBe(false)
    expect(db.listBotTeamMemory(team.id).map((entry) => entry.id)).toEqual([keep.id])
  })

  it('keeps only the lines of its own team', () => {
    const { db, team } = setup()
    const other = db.createBotTeam({
      name: 'Sales',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: []
    })
    db.addBotTeamMemory({
      teamId: other.id,
      botId: null,
      text: 'Elsewhere',
      source: { kind: 'person', taskTitle: null }
    })
    expect(db.listBotTeamMemory(team.id)).toEqual([])
  })

  it('adds its table to an older database and survives a restart from v6', () => {
    const { db, team } = setup()
    db.db.exec('DROP TABLE bot_team_memory')
    db.db.pragma('user_version = 52')
    db.migrate()
    expect(db.listBotTeamMemory(team.id)).toEqual([])
    db.db.pragma('user_version = 6')
    expect(() => db.migrate()).not.toThrow()
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })
})
