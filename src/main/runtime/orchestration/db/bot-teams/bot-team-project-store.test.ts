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
      goal: 'More sales'
    })

    expect(project).toEqual({
      id: expect.any(String),
      teamId: team.id,
      name: 'Summer campaign',
      goal: 'More sales'
    })
    expect(db.listBotTeamProjects(team.id)).toEqual([project])
  })

  it('moves a task into a project and out again, without changing the rest of it', () => {
    db = new OrchestrationDb(':memory:')
    const { team, task } = seed(db)
    expect(task.projectId).toBeNull()
    const project = db.createBotTeamProject({ teamId: team.id, name: 'Summer', goal: '' })

    db.setBotTeamTaskProject(task.id, project.id)
    expect(db.getBotTeamTask(task.id)).toEqual({ ...task, projectId: project.id })

    db.setBotTeamTaskProject(task.id, null)
    expect(db.getBotTeamTask(task.id)).toEqual(task)
  })

  it('refuses another team’s project and an unknown task', () => {
    db = new OrchestrationDb(':memory:')
    const { task } = seed(db)
    const other = seed(db, 'Sales')
    const foreign = db.createBotTeamProject({ teamId: other.team.id, name: 'Quotes', goal: '' })

    expect(() => db?.setBotTeamTaskProject(task.id, foreign.id)).toThrow('cannot move')
    expect(db.getBotTeamTask(task.id).projectId).toBeNull()
    expect(() => db?.setBotTeamTaskProject('missing', null)).toThrow('cannot move')
  })

  it('removes projects with their team', () => {
    db = new OrchestrationDb(':memory:')
    const { team, task } = seed(db)
    const project = db.createBotTeamProject({ teamId: team.id, name: 'Summer', goal: '' })
    db.setBotTeamTaskProject(task.id, project.id)

    db.deleteBotTeam(team.id)

    expect(db.listBotTeamProjects(team.id)).toEqual([])
  })
})
