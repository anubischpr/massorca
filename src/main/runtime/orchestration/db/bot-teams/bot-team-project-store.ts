import { z } from 'zod'
import {
  BotTeamProjectSchema,
  type BotTeamBrief,
  type BotTeamCodeSource,
  type BotTeamProject,
  type BotTeamProjectInput,
  type BotTeamProjectWorkspace
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'
import {
  deleteProjectRows,
  linkedTeamIdsByProject,
  listBotTeamProjectTasksOfOtherTeams,
  replaceLinkedTeams
} from './bot-team-project-teams-store'

const PROJECT_SELECT = `SELECT id, team_id AS teamId, name, goal, code_source AS codeSource,
  brief_json AS briefJson, brief_updated_at AS briefUpdatedAt,
  workspace_key AS workspaceKey, workspace_name AS workspaceName,
  archived_at AS archivedAt FROM bot_team_projects`

function projectFromRow(row: unknown): BotTeamProject {
  const { briefJson, workspaceKey, workspaceName, ...rest } = z
    .looseObject({
      briefJson: z.string().nullable(),
      workspaceKey: z.string().nullable(),
      workspaceName: z.string().nullable()
    })
    .parse(row)
  let brief: unknown = undefined
  try {
    brief = briefJson === null ? undefined : JSON.parse(briefJson)
  } catch {
    // An unreadable brief reads as empty: it must not hide the project.
  }
  const workspace =
    workspaceKey === null || workspaceName === null
      ? null
      : { key: workspaceKey, name: workspaceName }
  const parsed = BotTeamProjectSchema.safeParse({ ...rest, brief, workspace })
  return parsed.success
    ? parsed.data
    : BotTeamProjectSchema.parse({ ...rest, brief: undefined, workspace })
}

/** Reads projects with the teams each is linked to, so every reader sees one shape. */
function readProjects(db: OrchestrationDb, rows: unknown[]): BotTeamProject[] {
  const projects = rows.map(projectFromRow)
  const links = linkedTeamIdsByProject(
    db,
    projects.map((project) => project.id)
  )
  return projects.map((project) => ({ ...project, linkedTeamIds: links.get(project.id) ?? [] }))
}

function readProject(db: OrchestrationDb, projectId: string): BotTeamProject {
  const row = db.db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(projectId)
  if (row === undefined) {
    throw new Error(`Project ${projectId} was not found.`)
  }
  return readProjects(db, [row])[0]
}

function inSavepoint(db: OrchestrationDb, name: string, work: () => void): void {
  db.db.exec(`SAVEPOINT ${name}`)
  try {
    work()
    db.db.exec(`RELEASE ${name}`)
  } catch (error) {
    db.db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`)
    throw error
  }
}

export function createBotTeamProject(
  this: OrchestrationDb,
  input: BotTeamProjectInput
): BotTeamProject {
  const id = generateId('botproject')
  inSavepoint(this, 'create_bot_team_project', () => {
    this.db
      .prepare(
        'INSERT INTO bot_team_projects (id, team_id, name, goal, code_source) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, input.teamId, input.name, input.goal, input.codeSource)
    replaceLinkedTeams(this, { id, teamId: input.teamId }, input.linkedTeamIds ?? [])
  })
  return readProject(this, id)
}

/** Connects a project to code; its tasks then work on that code. */
export function setBotTeamProjectCodeSource(
  this: OrchestrationDb,
  projectId: string,
  codeSource: BotTeamCodeSource
): BotTeamProject {
  const changed = this.db
    .prepare('UPDATE bot_team_projects SET code_source = ? WHERE id = ?')
    .run(codeSource, projectId)
  if (changed.changes === 0) {
    throw new Error(`Project ${projectId} was not found.`)
  }
  return readProject(this, projectId)
}

export function getBotTeamProject(this: OrchestrationDb, projectId: string): BotTeamProject {
  return readProject(this, projectId)
}

export type BotTeamProjectListOptions = {
  /** Also the projects other teams own and linked this team to. */
  includeLinked?: boolean
  includeArchived?: boolean
}

/** By default only the projects the team owns that are not archived, as an older client expects. */
export function listBotTeamProjects(
  this: OrchestrationDb,
  teamId: string,
  options: BotTeamProjectListOptions = {}
): BotTeamProject[] {
  const owned = options.includeLinked
    ? '(team_id = ? OR id IN (SELECT project_id FROM bot_team_project_teams WHERE team_id = ?))'
    : 'team_id = ?'
  const archived = options.includeArchived ? '' : ' AND archived_at IS NULL'
  const params = options.includeLinked ? [teamId, teamId] : [teamId]
  return readProjects(
    this,
    this.db.prepare(`${PROJECT_SELECT} WHERE ${owned}${archived} ORDER BY rowid`).all(...params)
  )
}

export function updateBotTeamProject(
  this: OrchestrationDb,
  projectId: string,
  input: { name?: string; goal?: string }
): BotTeamProject {
  const current = readProject(this, projectId)
  this.db
    .prepare('UPDATE bot_team_projects SET name = ?, goal = ? WHERE id = ?')
    .run(input.name?.trim() || current.name, input.goal?.trim() ?? current.goal, projectId)
  return readProject(this, projectId)
}

/** Replaces the teams a project is linked to; the owner is never one of them. */
export function setBotTeamProjectLinkedTeams(
  this: OrchestrationDb,
  projectId: string,
  teamIds: readonly string[]
): BotTeamProject {
  replaceLinkedTeams(this, readProject(this, projectId), teamIds)
  return readProject(this, projectId)
}

/** Archiving hides a project and deletes nothing. */
export function setBotTeamProjectArchived(
  this: OrchestrationDb,
  projectId: string,
  archived: boolean
): BotTeamProject {
  const changed = this.db
    .prepare('UPDATE bot_team_projects SET archived_at = ? WHERE id = ?')
    .run(archived ? Date.now() : null, projectId)
  if (changed.changes === 0) {
    throw new Error(`Project ${projectId} was not found.`)
  }
  return readProject(this, projectId)
}

export function deleteBotTeamProject(this: OrchestrationDb, projectId: string): void {
  readProject(this, projectId)
  inSavepoint(this, 'delete_bot_team_project', () => deleteProjectRows(this, projectId))
}

/** Links a project to a workspace on the team's host, or unlinks it with null. */
export function setBotTeamProjectWorkspace(
  this: OrchestrationDb,
  projectId: string,
  workspace: BotTeamProjectWorkspace | null
): BotTeamProject {
  const changed = this.db
    .prepare('UPDATE bot_team_projects SET workspace_key = ?, workspace_name = ? WHERE id = ?')
    .run(workspace?.key ?? null, workspace?.name ?? null, projectId)
  if (changed.changes === 0) {
    throw new Error(`Project ${projectId} was not found.`)
  }
  return readProject(this, projectId)
}

const withoutBlanks = (lines: string[]): string[] =>
  lines.map((line) => line.trim()).filter((line) => line !== '')

/** Saves what the person wrote in the Brief; the bots of the project's tasks read it. */
export function setBotTeamProjectBrief(
  this: OrchestrationDb,
  projectId: string,
  input: { goal: string; brief: BotTeamBrief }
): BotTeamProject {
  const brief: BotTeamBrief = {
    requirements: withoutBlanks(input.brief.requirements),
    constraints: withoutBlanks(input.brief.constraints),
    decisions: withoutBlanks(input.brief.decisions)
  }
  const changed = this.db
    .prepare(
      'UPDATE bot_team_projects SET goal = ?, brief_json = ?, brief_updated_at = ? WHERE id = ?'
    )
    .run(input.goal.trim(), JSON.stringify(brief), Date.now(), projectId)
  if (changed.changes === 0) {
    throw new Error(`Project ${projectId} was not found.`)
  }
  return readProject(this, projectId)
}

/** Puts a task in a project of its own team or one linked to it, or takes it out with null. */
export function setBotTeamTaskProject(
  this: OrchestrationDb,
  taskId: string,
  projectId: string | null
): void {
  const changed =
    projectId === null
      ? this.db.prepare('UPDATE bot_team_tasks SET project_id = NULL WHERE id = ?').run(taskId)
      : this.db
          .prepare(
            `UPDATE bot_team_tasks SET project_id = ?
             WHERE id = ? AND (
               team_id = (SELECT team_id FROM bot_team_projects WHERE id = ?)
               OR EXISTS (
                 SELECT 1 FROM bot_team_project_teams
                 WHERE project_id = ? AND team_id = bot_team_tasks.team_id
               )
             )`
          )
          .run(projectId, taskId, projectId, projectId)
  if (changed.changes === 0) {
    throw new Error(`Task ${taskId} cannot move to that project.`)
  }
}

export type BotTeamProjectStoreMethods = {
  createBotTeamProject: typeof createBotTeamProject
  deleteBotTeamProject: typeof deleteBotTeamProject
  getBotTeamProject: typeof getBotTeamProject
  listBotTeamProjects: typeof listBotTeamProjects
  listBotTeamProjectTasksOfOtherTeams: typeof listBotTeamProjectTasksOfOtherTeams
  setBotTeamProjectArchived: typeof setBotTeamProjectArchived
  setBotTeamProjectLinkedTeams: typeof setBotTeamProjectLinkedTeams
  updateBotTeamProject: typeof updateBotTeamProject
  setBotTeamProjectBrief: typeof setBotTeamProjectBrief
  setBotTeamProjectCodeSource: typeof setBotTeamProjectCodeSource
  setBotTeamProjectWorkspace: typeof setBotTeamProjectWorkspace
  setBotTeamTaskProject: typeof setBotTeamTaskProject
}

export function attachBotTeamProjectStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    createBotTeamProject,
    deleteBotTeamProject,
    getBotTeamProject,
    listBotTeamProjects,
    listBotTeamProjectTasksOfOtherTeams,
    setBotTeamProjectArchived,
    setBotTeamProjectLinkedTeams,
    updateBotTeamProject,
    setBotTeamProjectBrief,
    setBotTeamProjectCodeSource,
    setBotTeamProjectWorkspace,
    setBotTeamTaskProject
  })
}
