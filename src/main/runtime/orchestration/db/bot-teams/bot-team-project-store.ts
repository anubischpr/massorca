import { z } from 'zod'
import {
  BotTeamProjectSchema,
  type BotTeamBrief,
  type BotTeamCodeSource,
  type BotTeamProject,
  type BotTeamProjectInput
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

const PROJECT_SELECT = `SELECT id, team_id AS teamId, name, goal, code_source AS codeSource,
  brief_json AS briefJson, brief_updated_at AS briefUpdatedAt FROM bot_team_projects`

function projectFromRow(row: unknown): BotTeamProject {
  const { briefJson, ...rest } = z.looseObject({ briefJson: z.string().nullable() }).parse(row)
  let brief: unknown = undefined
  try {
    brief = briefJson === null ? undefined : JSON.parse(briefJson)
  } catch {
    // An unreadable brief reads as empty: it must not hide the project.
  }
  const parsed = BotTeamProjectSchema.safeParse({ ...rest, brief })
  return parsed.success ? parsed.data : BotTeamProjectSchema.parse({ ...rest, brief: undefined })
}

export function createBotTeamProject(
  this: OrchestrationDb,
  input: BotTeamProjectInput
): BotTeamProject {
  const id = generateId('botproject')
  this.db
    .prepare(
      'INSERT INTO bot_team_projects (id, team_id, name, goal, code_source) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, input.teamId, input.name, input.goal, input.codeSource)
  return projectFromRow(this.db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(id))
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
  return projectFromRow(this.db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(projectId))
}

export function listBotTeamProjects(this: OrchestrationDb, teamId: string): BotTeamProject[] {
  return this.db
    .prepare(`${PROJECT_SELECT} WHERE team_id = ? ORDER BY rowid`)
    .all(teamId)
    .map(projectFromRow)
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
  return projectFromRow(this.db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(projectId))
}

/** Puts a task in a project of its own team, or takes it out with null. */
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
             WHERE id = ? AND team_id = (SELECT team_id FROM bot_team_projects WHERE id = ?)`
          )
          .run(projectId, taskId, projectId)
  if (changed.changes === 0) {
    throw new Error(`Task ${taskId} cannot move to that project.`)
  }
}

export type BotTeamProjectStoreMethods = {
  createBotTeamProject: typeof createBotTeamProject
  listBotTeamProjects: typeof listBotTeamProjects
  setBotTeamProjectBrief: typeof setBotTeamProjectBrief
  setBotTeamProjectCodeSource: typeof setBotTeamProjectCodeSource
  setBotTeamTaskProject: typeof setBotTeamTaskProject
}

export function attachBotTeamProjectStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    createBotTeamProject,
    listBotTeamProjects,
    setBotTeamProjectBrief,
    setBotTeamProjectCodeSource,
    setBotTeamTaskProject
  })
}
