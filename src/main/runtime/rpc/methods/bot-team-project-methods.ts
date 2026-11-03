import {
  BotTeamProjectArchive,
  BotTeamProjectDelete,
  BotTeamProjectUpdate,
  type BotTeamProject,
  type BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { defineMethod } from '../core'

/** What a team's room lists as projects: an older client gets its own, a newer one also the shared. */
export function roomProjectsFor(
  db: OrchestrationDb,
  { teamId, withLinkedProjects }: { teamId: string; withLinkedProjects?: boolean }
): { projects: BotTeamProject[]; projectTasks?: BotTeamTask[] } {
  if (!withLinkedProjects) {
    return { projects: db.listBotTeamProjects(teamId) }
  }
  return {
    projects: db.listBotTeamProjects(teamId, { includeLinked: true, includeArchived: true }),
    projectTasks: db.listBotTeamProjectTasksOfOtherTeams(teamId)
  }
}

function requireProjectOfTeam(
  db: OrchestrationDb,
  projectId: string,
  teamId: string
): BotTeamProject {
  const project = db.getBotTeamProject(projectId)
  if (project.teamId !== teamId && !(project.linkedTeamIds ?? []).includes(teamId)) {
    const team = db.listBotTeams().find((entry) => entry.id === teamId)
    throw new Error(`${project.name} is not a project of ${team?.name ?? teamId}.`)
  }
  return project
}

function requireOwner(
  db: OrchestrationDb,
  projectId: string,
  teamId: string,
  action: string
): BotTeamProject {
  const project = requireProjectOfTeam(db, projectId, teamId)
  if (project.teamId !== teamId) {
    throw new Error(`Only the team that owns ${project.name} can ${action} it.`)
  }
  return project
}

export const botTeamUpdateProjectMethod = defineMethod({
  name: 'botTeams.updateProject',
  permission: 'workspace',
  params: BotTeamProjectUpdate,
  handler: ({ projectId, teamId, name, goal, linkedTeamIds }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    requireProjectOfTeam(db, projectId, teamId)
    // Checked before any write, so a bad team id leaves the name and goal as they were.
    const known = new Set(db.listBotTeams().map((entry) => entry.id))
    const missing = linkedTeamIds?.find((id) => !known.has(id))
    if (missing !== undefined) {
      throw new Error(`Team ${missing} was not found.`)
    }
    db.updateBotTeamProject(projectId, { name, goal })
    return {
      project:
        linkedTeamIds === undefined
          ? db.getBotTeamProject(projectId)
          : db.setBotTeamProjectLinkedTeams(projectId, linkedTeamIds)
    }
  }
})

export const botTeamArchiveProjectMethod = defineMethod({
  name: 'botTeams.archiveProject',
  permission: 'workspace',
  params: BotTeamProjectArchive,
  handler: ({ projectId, teamId, archived }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    requireOwner(db, projectId, teamId, 'archive or restore')
    return { project: db.setBotTeamProjectArchived(projectId, archived) }
  }
})

export const botTeamDeleteProjectMethod = defineMethod({
  name: 'botTeams.deleteProject',
  permission: 'workspace',
  params: BotTeamProjectDelete,
  handler: ({ projectId, teamId }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    requireOwner(db, projectId, teamId, 'delete')
    db.deleteBotTeamProject(projectId)
    return { deleted: true as const }
  }
})

export const BOT_TEAM_PROJECT_METHODS = [
  botTeamUpdateProjectMethod,
  botTeamArchiveProjectMethod,
  botTeamDeleteProjectMethod
]
