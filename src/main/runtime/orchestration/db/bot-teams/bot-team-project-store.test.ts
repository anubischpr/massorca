import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../contract-constants'
import { OrchestrationDb } from '../orchestration-db'
import { migrateV56 } from '../schema/migrate-v56'

/** Why: the project store reads the workspace link columns, which the v56 step adds. */
function openDb(): OrchestrationDb {
  const open = new OrchestrationDb(':memory:')
  migrateV56.call(open, SCHEMA_VERSION)
  return open
}

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
    db = openDb()
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
      briefUpdatedAt: null,
      workspace: null,
      archivedAt: null,
      linkedTeamIds: []
    })
    expect(db.listBotTeamProjects(team.id)).toEqual([project])
  })

  it('moves a task into a project and out again, without changing the rest of it', () => {
    db = openDb()
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
    db = openDb()
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
    db = openDb()
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
    db = openDb()
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
    db = openDb()
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
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })

  it('stores a project brief with its goal, drops blank lines and stamps the time', () => {
    db = openDb()
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

  it('keeps the Brief as Markdown beside the lists, and a list-only save from an older client keeps it', () => {
    db = openDb()
    const { team } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: '',
      codeSource: null
    })
    const markdown = '## Requirements\n- Flyer for the offers\n\nIris lays out the flyer.'

    const withMarkdown = db.setBotTeamProjectBrief(project.id, {
      goal: 'Sell the offers',
      brief: { requirements: ['Flyer for the offers'], constraints: [], decisions: [], markdown }
    })
    expect(withMarkdown.brief).toEqual({
      requirements: ['Flyer for the offers'],
      constraints: [],
      decisions: [],
      markdown
    })
    expect(db.listBotTeamProjects(team.id)[0]?.brief.markdown).toBe(markdown)

    // Why: an older client has no Markdown to send; the stored Markdown is what bots read, so it stays.
    const listsOnly = db.setBotTeamProjectBrief(project.id, {
      goal: 'Sell the offers',
      brief: { requirements: ['Offer email'], constraints: [], decisions: [] }
    })
    expect(listsOnly.brief).toEqual({
      requirements: ['Offer email'],
      constraints: [],
      decisions: [],
      markdown
    })
    expect(db.listBotTeamProjects(team.id)[0]?.brief.markdown).toBe(markdown)
  })

  it('reads an unreadable stored brief as empty instead of failing the list', () => {
    db = openDb()
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
    db = openDb()
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
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })

  it('links a project to a workspace on the host, names it, and unlinks it', () => {
    db = openDb()
    const { team } = seed(db)
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: '',
      codeSource: 'repo'
    })
    expect(project.workspace).toBeNull()

    const linked = db.setBotTeamProjectWorkspace(project.id, {
      key: 'worktree:repo-1::/work/nexus',
      name: 'NexusCare'
    })
    expect(linked.workspace).toEqual({ key: 'worktree:repo-1::/work/nexus', name: 'NexusCare' })
    expect(db.getBotTeamProject(project.id)).toEqual(linked)
    expect(db.listBotTeamProjects(team.id)).toEqual([linked])

    expect(db.setBotTeamProjectWorkspace(project.id, null).workspace).toBeNull()
    expect(() => db?.setBotTeamProjectWorkspace('missing', null)).toThrow('was not found')
    expect(() => db?.getBotTeamProject('missing')).toThrow('was not found')
  })
})
