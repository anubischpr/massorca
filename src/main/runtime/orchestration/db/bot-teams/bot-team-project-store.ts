import { z } from 'zod'
import {
  BotTeamProjectSchema,
  type BotTeamProject,
  type BotTeamProjectInput
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

const PROJECT_SELECT = 'SELECT id, team_id AS teamId, name, goal FROM bot_team_projects'

export function createBotTeamProject(
  this: OrchestrationDb,
  input: BotTeamProjectInput
): BotTeamProject {
  const id = generateId('botproject')
  this.db
    .prepare('INSERT INTO bot_team_projects (id, team_id, name, goal) VALUES (?, ?, ?, ?)')
    .run(id, input.teamId, input.name, input.goal)
  return BotTeamProjectSchema.parse(this.db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(id))
}

export function listBotTeamProjects(this: OrchestrationDb, teamId: string): BotTeamProject[] {
  return z
    .array(BotTeamProjectSchema)
    .parse(this.db.prepare(`${PROJECT_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
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
  setBotTeamTaskProject: typeof setBotTeamTaskProject
}

export function attachBotTeamProjectStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    createBotTeamProject,
    listBotTeamProjects,
    setBotTeamTaskProject
  })
}
