import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team project store', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function seed(open: OrchestrationDb, name = 'Marketing') {
    const team = open.createBotTeam({
      name,
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const task = open.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: '',
      ownerBotId: team.bots[0].id
    })
    return { team, task }
  }

  it('creates and lists a team’s projects', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer campaign',
      goal: 'More sales',
      codeSource: null
    })

    expect(project).toEqual({
      id: expect.any(String),
      teamId: team.id,
      name: 'Summer campaign',
      goal: 'More sales',
      codeSource: null,
      brief: { requirements: [], constraints: [], decisions: [] },
      briefUpdatedAt: null
    })
    expect(db.listBotTeamProjects(team.id)).toEqual([project])
  })

  it('moves a task into a project and out again, without changing the rest of it', () => {
    db = new OrchestrationDb(':memory:')
    const { team, task } = seed(db)
    expect(task.projectId).toBeNull()
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: '',
      codeSource: null
    })

    db.setBotTeamTaskProject(task.id, project.id)
    expect(db.getBotTeamTask(task.id)).toEqual({ ...task, projectId: project.id })

    db.setBotTeamTaskProject(task.id, null)
    expect(db.getBotTeamTask(task.id)).toEqual(task)
  })

  it('refuses another team’s project and an unknown task', () => {
    db = new OrchestrationDb(':memory:')
    const { task } = seed(db)
    const other = seed(db, 'Sales')
    const foreign = db.createBotTeamProject({
      teamId: other.team.id,
      name: 'Quotes',
      goal: '',
      codeSource: null
    })

    expect(() => db?.setBotTeamTaskProject(task.id, foreign.id)).toThrow('cannot move')
    expect(db.getBotTeamTask(task.id).projectId).toBeNull()
    expect(() => db?.setBotTeamTaskProject('missing', null)).toThrow('cannot move')
  })

  it('removes projects with their team', () => {
    db = new OrchestrationDb(':memory:')
    const { team, task } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: '',
      codeSource: null
    })
    db.setBotTeamTaskProject(task.id, project.id)

    db.deleteBotTeam(team.id)

    expect(db.listBotTeamProjects(team.id)).toEqual([])
  })

  it('keeps the code source a project was created with, and connects one later', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    const made = db.createBotTeamProject({
      teamId: team.id,
      name: 'Website',
      goal: '',
      codeSource: 'repo'
    })
    const plain = db.createBotTeamProject({
      teamId: team.id,
      name: 'Flyer',
      goal: '',
      codeSource: null
    })
    expect(made.codeSource).toBe('repo')
    expect(plain.codeSource).toBeNull()

    expect(db.setBotTeamProjectCodeSource(plain.id, 'folder').codeSource).toBe('folder')
    expect(db.listBotTeamProjects(team.id).map((project) => project.codeSource)).toEqual([
      'repo',
      'folder'
    ])
    expect(() => db?.setBotTeamProjectCodeSource('missing', 'repo')).toThrow('was not found')
  })

  it('adds the code source column to a v48 database and survives a replay', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    db.createBotTeamProject({ teamId: team.id, name: 'Summer', goal: 'Sales', codeSource: null })
    db.db.exec('ALTER TABLE bot_team_projects DROP COLUMN code_source')
    db.db.pragma('user_version = 48')

    db.migrate()
    expect(db.listBotTeamProjects(team.id)).toEqual([
      expect.objectContaining({ name: 'Summer', goal: 'Sales', codeSource: null })
    ])

    // A skewed database restarts from v6 with the column already there.
    db.db.pragma('user_version = 6')
    expect(() => db?.migrate()).not.toThrow()
    expect(db.db.pragma('user_version', { simple: true })).toBe(50)
  })

  it('stores a project brief with its goal, drops blank lines and stamps the time', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: 'Old goal',
      codeSource: null
    })

    const saved = db.setBotTeamProjectBrief(project.id, {
      goal: 'Sell the offers',
      brief: {
        requirements: ['Flyer for the offers', '  ', 'Offer email'],
        constraints: ['Prices are checked first'],
        decisions: []
      }
    })

    expect(saved).toEqual({
      ...project,
      goal: 'Sell the offers',
      brief: {
        requirements: ['Flyer for the offers', 'Offer email'],
        constraints: ['Prices are checked first'],
        decisions: []
      },
      briefUpdatedAt: expect.any(Number)
    })
    expect(db.listBotTeamProjects(team.id)).toEqual([saved])
    expect(() =>
      db?.setBotTeamProjectBrief('missing', {
        goal: '',
        brief: { requirements: [], constraints: [], decisions: [] }
      })
    ).toThrow('was not found')
  })

  it('reads an unreadable stored brief as empty instead of failing the list', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'S',
      goal: '',
      codeSource: null
    })
    db.db
      .prepare('UPDATE bot_team_projects SET brief_json = ? WHERE id = ?')
      .run('{nope', project.id)

    expect(db.listBotTeamProjects(team.id)[0].brief).toEqual({
      requirements: [],
      constraints: [],
      decisions: []
    })
  })

  it('adds the brief columns to a v49 database and survives a replay', () => {
    db = new OrchestrationDb(':memory:')
    const { team } = seed(db)
    db.createBotTeamProject({ teamId: team.id, name: 'Summer', goal: 'Sales', codeSource: 'repo' })
    db.db.exec('ALTER TABLE bot_team_projects DROP COLUMN brief_json')
    db.db.exec('ALTER TABLE bot_team_projects DROP COLUMN brief_updated_at')
    db.db.pragma('user_version = 49')

    db.migrate()
    expect(db.listBotTeamProjects(team.id)).toEqual([
      expect.objectContaining({ name: 'Summer', codeSource: 'repo', briefUpdatedAt: null })
    ])

    db.db.pragma('user_version = 6')
    expect(() => db?.migrate()).not.toThrow()
    expect(db.db.pragma('user_version', { simple: true })).toBe(50)
  })
})
