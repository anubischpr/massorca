import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team project teams', () => {
  let db: OrchestrationDb

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  function team(name: string) {
    return db.createBotTeam({
      name,
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: `${name} bot`, job: '', agent: 'claude' }]
    })
  }

  function project(owner: { id: string }, name = 'NexusCare', linkedTeamIds?: string[]) {
    return db.createBotTeamProject({
      teamId: owner.id,
      name,
      goal: '',
      codeSource: null,
      ...(linkedTeamIds ? { linkedTeamIds } : {})
    })
  }

  const names = (teamId: string, options = {}): string[] =>
    db.listBotTeamProjects(teamId, options).map((entry) => entry.name)

  it('creates a project linked to other teams, never twice to the owner', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    const created = project(marketing, 'NexusCare', [development.id, development.id, marketing.id])

    expect(created.linkedTeamIds).toEqual([development.id])
    expect(created.archivedAt).toBeNull()
  })

  it('shows a linked project to the linked team and keeps it from older readers', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    project(marketing, 'NexusCare', [development.id])

    expect(names(development.id, { includeLinked: true })).toEqual(['NexusCare'])
    // The default read is the owner team's own projects, as an older client expects.
    expect(names(development.id)).toEqual([])
    expect(names(marketing.id)).toEqual(['NexusCare'])
  })

  it('unlinking removes the project from that team only; the owner keeps it and its tasks', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    const shared = project(marketing, 'NexusCare', [development.id])
    const task = db.createBotTeamTask({
      teamId: development.id,
      title: 'Booking page',
      prompt: '',
      ownerBotId: development.bots[0].id
    })
    db.setBotTeamTaskProject(task.id, shared.id)

    const after = db.setBotTeamProjectLinkedTeams(shared.id, [])

    expect(after.linkedTeamIds).toEqual([])
    expect(names(development.id, { includeLinked: true })).toEqual([])
    expect(names(marketing.id)).toEqual(['NexusCare'])
    // The task the unlinked team already made stays with the project.
    expect(db.getBotTeamTask(task.id).projectId).toBe(shared.id)
    expect(db.listBotTeamProjectTasksOfOtherTeams(marketing.id).map((entry) => entry.id)).toEqual([
      task.id
    ])
  })

  it('refuses to link a team that does not exist', () => {
    const marketing = team('Marketing')
    const shared = project(marketing)
    expect(() => db.setBotTeamProjectLinkedTeams(shared.id, ['nope'])).toThrow(
      'Team nope was not found.'
    )
  })

  it('lets a linked team file its own task in the project, and an unrelated team not', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    const sales = team('Sales')
    const shared = project(marketing, 'NexusCare', [development.id])
    const makeTask = (owner: ReturnType<typeof team>) =>
      db.createBotTeamTask({
        teamId: owner.id,
        title: 'Task',
        prompt: '',
        ownerBotId: owner.bots[0].id
      })

    const linkedTask = makeTask(development)
    db.setBotTeamTaskProject(linkedTask.id, shared.id)
    expect(db.getBotTeamTask(linkedTask.id).projectId).toBe(shared.id)

    const strangerTask = makeTask(sales)
    expect(() => db.setBotTeamTaskProject(strangerTask.id, shared.id)).toThrow(
      `Task ${strangerTask.id} cannot move to that project.`
    )
  })

  it('archives and restores a project; archived ones are listed only on request', () => {
    const marketing = team('Marketing')
    const shared = project(marketing)

    const archived = db.setBotTeamProjectArchived(shared.id, true)
    expect(archived.archivedAt).toEqual(expect.any(Number))
    expect(names(marketing.id)).toEqual([])
    expect(names(marketing.id, { includeArchived: true })).toEqual(['NexusCare'])

    expect(db.setBotTeamProjectArchived(shared.id, false).archivedAt).toBeNull()
    expect(names(marketing.id)).toEqual(['NexusCare'])
  })

  it('deletes a project with every team’s tasks in it and its links, and nothing else', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    const shared = project(marketing, 'NexusCare', [development.id])
    const other = project(marketing, 'Summer campaign')
    const inShared = db.createBotTeamTask({
      teamId: development.id,
      title: 'Booking page',
      prompt: '',
      ownerBotId: development.bots[0].id
    })
    db.setBotTeamTaskProject(inShared.id, shared.id)
    const outside = db.createBotTeamTask({
      teamId: marketing.id,
      title: 'Loose',
      prompt: '',
      ownerBotId: marketing.bots[0].id
    })

    db.deleteBotTeamProject(shared.id)

    expect(() => db.getBotTeamProject(shared.id)).toThrow()
    expect(() => db.getBotTeamTask(inShared.id)).toThrow()
    expect(db.getBotTeamTask(outside.id).id).toBe(outside.id)
    expect(names(marketing.id)).toEqual([other.name])
    expect(names(development.id, { includeLinked: true })).toEqual([])
  })

  it('deleting the owner team deletes its projects even when another team has tasks in them', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    const shared = project(marketing, 'NexusCare', [development.id])
    const task = db.createBotTeamTask({
      teamId: development.id,
      title: 'Booking page',
      prompt: '',
      ownerBotId: development.bots[0].id
    })
    db.setBotTeamTaskProject(task.id, shared.id)

    db.deleteBotTeam(marketing.id)

    expect(() => db.getBotTeamProject(shared.id)).toThrow()
    expect(() => db.getBotTeamTask(task.id)).toThrow()
    expect(db.listBotTeams().map((entry) => entry.name)).toEqual(['Development'])
  })

  it('deleting a linked team only unlinks it', () => {
    const marketing = team('Marketing')
    const development = team('Development')
    project(marketing, 'NexusCare', [development.id])

    db.deleteBotTeam(development.id)

    expect(names(marketing.id)).toEqual(['NexusCare'])
    expect(db.listBotTeamProjects(marketing.id)[0].linkedTeamIds).toEqual([])
  })

  it('renames a project and changes its goal', () => {
    const marketing = team('Marketing')
    const shared = project(marketing)
    const updated = db.updateBotTeamProject(shared.id, { name: 'NexusCare 2', goal: 'Launch' })
    expect(updated).toMatchObject({ name: 'NexusCare 2', goal: 'Launch' })
  })
})
