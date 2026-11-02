import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'
import {
  botTeamArchiveProjectMethod,
  botTeamDeleteProjectMethod,
  botTeamUpdateProjectMethod,
  roomProjectsFor
} from './bot-team-project-methods'

describe('bot team project methods', () => {
  let db: OrchestrationDb
  let ctx: RpcContext

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers read only the orchestration database.
    ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext
  })

  afterEach(() => {
    db.close()
  })

  const team = (name: string) =>
    db.createBotTeam({
      name,
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: `${name} bot`, job: '', agent: 'claude' }]
    })

  function shared() {
    const marketing = team('Marketing')
    const development = team('Development')
    const project = db.createBotTeamProject({
      teamId: marketing.id,
      name: 'NexusCare',
      goal: '',
      codeSource: null,
      linkedTeamIds: [development.id]
    })
    return { marketing, development, project }
  }

  it('lets the owner team archive, restore and delete', async () => {
    const { marketing, project } = shared()

    const archived = await botTeamArchiveProjectMethod.handler(
      { projectId: project.id, teamId: marketing.id, archived: true },
      ctx
    )
    expect(archived.project.archivedAt).toEqual(expect.any(Number))
    const restored = await botTeamArchiveProjectMethod.handler(
      { projectId: project.id, teamId: marketing.id, archived: false },
      ctx
    )
    expect(restored.project.archivedAt).toBeNull()

    await botTeamDeleteProjectMethod.handler({ projectId: project.id, teamId: marketing.id }, ctx)
    expect(() => db.getBotTeamProject(project.id)).toThrow()
  })

  it('refuses a linked team that tries to archive, restore or delete', () => {
    const { development, project } = shared()

    expect(() =>
      botTeamArchiveProjectMethod.handler(
        { projectId: project.id, teamId: development.id, archived: true },
        ctx
      )
    ).toThrow('Only the team that owns NexusCare can archive or restore it.')
    expect(() =>
      botTeamDeleteProjectMethod.handler({ projectId: project.id, teamId: development.id }, ctx)
    ).toThrow('Only the team that owns NexusCare can delete it.')
    expect(db.getBotTeamProject(project.id).archivedAt).toBeNull()
  })

  it('refuses a team the project does not belong to at all', () => {
    const { project } = shared()
    const sales = team('Sales')
    expect(() =>
      botTeamUpdateProjectMethod.handler(
        { projectId: project.id, teamId: sales.id, name: 'Other' },
        ctx
      )
    ).toThrow('NexusCare is not a project of Sales.')
  })

  it('edits name, goal and linked teams; unlinking keeps the project in the owner team', async () => {
    const { marketing, development, project } = shared()
    const sales = team('Sales')

    const edited = await botTeamUpdateProjectMethod.handler(
      {
        projectId: project.id,
        teamId: marketing.id,
        name: 'NexusCare 2',
        goal: 'Launch',
        linkedTeamIds: [sales.id]
      },
      ctx
    )
    expect(edited.project).toMatchObject({
      name: 'NexusCare 2',
      goal: 'Launch',
      linkedTeamIds: [sales.id]
    })
    expect(db.listBotTeamProjects(development.id, { includeLinked: true })).toEqual([])
    expect(db.listBotTeamProjects(marketing.id)).toHaveLength(1)
  })

  it('lets a linked team edit but never take the owner out or add itself as owner', async () => {
    const { marketing, development, project } = shared()

    const edited = await botTeamUpdateProjectMethod.handler(
      { projectId: project.id, teamId: development.id, linkedTeamIds: [marketing.id] },
      ctx
    )
    // The owner is never a linked team; the acting team just unlinked itself.
    expect(edited.project.linkedTeamIds).toEqual([])
    expect(edited.project.teamId).toBe(marketing.id)
  })

  it('shows a linked team the project and the tasks other teams filed in it', () => {
    const { marketing, development, project } = shared()
    const task = db.createBotTeamTask({
      teamId: marketing.id,
      title: 'Launch email',
      prompt: '',
      ownerBotId: marketing.bots[0].id
    })
    db.setBotTeamTaskProject(task.id, project.id)

    const seen = roomProjectsFor(db, { teamId: development.id, withLinkedProjects: true })
    expect(seen.projects.map((entry) => entry.name)).toEqual(['NexusCare'])
    expect(seen.projectTasks?.map((entry) => entry.id)).toEqual([task.id])
  })

  it('serves an older client only the owner team’s projects, without archived ones or extras', () => {
    const { marketing, development, project } = shared()
    expect(roomProjectsFor(db, { teamId: development.id })).toEqual({ projects: [] })

    db.setBotTeamProjectArchived(project.id, true)
    expect(roomProjectsFor(db, { teamId: marketing.id }).projects).toEqual([])
    expect(
      roomProjectsFor(db, { teamId: marketing.id, withLinkedProjects: true }).projects
    ).toHaveLength(1)
  })
})
