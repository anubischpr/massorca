import { z } from 'zod'
import {
  BotTeamTaskSchema,
  type BotTeamTask
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../orchestration-db'

const LinkRows = z.array(z.object({ projectId: z.string(), teamId: z.string() }))

/** The teams each project is linked to besides its owner, by project id. */
export function linkedTeamIdsByProject(
  db: OrchestrationDb,
  projectIds: readonly string[]
): Map<string, string[]> {
  const byProject = new Map<string, string[]>(projectIds.map((id) => [id, []]))
  if (projectIds.length === 0) {
    return byProject
  }
  const marks = projectIds.map(() => '?').join(', ')
  const rows = LinkRows.parse(
    db.db
      .prepare(
        `SELECT project_id AS projectId, team_id AS teamId FROM bot_team_project_teams
         WHERE project_id IN (${marks}) ORDER BY rowid`
      )
      .all(...projectIds)
  )
  for (const row of rows) {
    byProject.get(row.projectId)?.push(row.teamId)
  }
  return byProject
}

/** Replaces a project's linked teams; the owner is never one of them. */
export function replaceLinkedTeams(
  db: OrchestrationDb,
  project: { id: string; teamId: string },
  teamIds: readonly string[]
): void {
  const wanted = [...new Set(teamIds)].filter((id) => id !== project.teamId)
  for (const id of wanted) {
    if (db.db.prepare('SELECT id FROM bot_teams WHERE id = ?').get(id) === undefined) {
      throw new Error(`Team ${id} was not found.`)
    }
  }
  db.db.prepare('DELETE FROM bot_team_project_teams WHERE project_id = ?').run(project.id)
  const insert = db.db.prepare(
    'INSERT INTO bot_team_project_teams (project_id, team_id) VALUES (?, ?)'
  )
  for (const id of wanted) {
    insert.run(project.id, id)
  }
}

/** Removes a project, the tasks every team filed in it, and its links. Files are not touched. */
export function deleteProjectRows(db: OrchestrationDb, projectId: string): void {
  const inProject = 'SELECT id FROM bot_team_tasks WHERE project_id = ?'
  db.db
    .prepare(`DELETE FROM bot_team_task_delegations WHERE task_id IN (${inProject})`)
    .run(projectId)
  db.db.prepare('DELETE FROM bot_team_tasks WHERE project_id = ?').run(projectId)
  db.db.prepare('DELETE FROM bot_team_project_teams WHERE project_id = ?').run(projectId)
  db.db.prepare('DELETE FROM bot_team_projects WHERE id = ?').run(projectId)
}

/** Tasks that other teams filed in the projects this team owns or is linked to. */
export function listBotTeamProjectTasksOfOtherTeams(
  this: OrchestrationDb,
  teamId: string
): BotTeamTask[] {
  return z.array(BotTeamTaskSchema).parse(
    this.db
      .prepare(
        `SELECT id, team_id AS teamId, title, prompt, owner_bot_id AS ownerBotId,
           session_id AS sessionId, project_id AS projectId, created_at AS createdAt,
           last_status AS lastStatus
         FROM bot_team_tasks
         WHERE team_id != ? AND project_id IN (
           SELECT id FROM bot_team_projects WHERE team_id = ?
           UNION SELECT project_id FROM bot_team_project_teams WHERE team_id = ?
         ) ORDER BY rowid`
      )
      .all(teamId, teamId, teamId)
  )
}
