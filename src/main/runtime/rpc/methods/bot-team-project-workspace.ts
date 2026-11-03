import { parseBotTeamProjectKey } from '../../../../shared/bot-team-project-workspace-key'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  BotTeamProjectSetWorkspace,
  BotTeamRoomSelector
} from '../../../../shared/rpc-contract/bot-team-room-params'
import {
  findBotTeamWorkspaceProject,
  listBotTeamLinkableWorkspaces,
  workspaceProjectSource
} from '../../../bot-teams/bot-team-project-workspace'
import type { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { defineMethod } from '../core'

function teamNamed(db: OrchestrationDb, teamId: string): BotTeam {
  const team = db.listBotTeams().find((entry) => entry.id === teamId)
  if (!team) {
    throw new Error(`Team ${teamId} was not found.`)
  }
  return team
}

/** Why: a team with Workspaces off never shows the choice, so the host refuses it too. */
function requireWorkspacesOn(team: BotTeam): void {
  if (!team.workspacesEnabled) {
    throw new Error(`Turn on Workspaces for ${team.name} to link a Workspaces project.`)
  }
}

/**
 * Why: a link saved when the picker listed worktrees names one; its project is only known to the
 * host, not to the orchestration database, so such links are rewritten as the picker opens.
 */
async function relinkWorktreeLinks(
  db: OrchestrationDb,
  teamId: string,
  source: ReturnType<typeof workspaceProjectSource>
): Promise<void> {
  for (const project of db.listBotTeamProjects(teamId, { includeArchived: true })) {
    if (!project.workspace || parseBotTeamProjectKey(project.workspace.key)) {
      continue
    }
    const found = await findBotTeamWorkspaceProject(source, project.workspace.key)
    if (found) {
      db.setBotTeamProjectWorkspace(project.id, { key: found.entry.key, name: found.entry.name })
    }
  }
}

export const botTeamListLinkableWorkspacesMethod = defineMethod({
  name: 'botTeams.listLinkableWorkspaces',
  permission: 'workspace',
  params: BotTeamRoomSelector,
  handler: async ({ teamId }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    requireWorkspacesOn(teamNamed(db, teamId))
    const source = workspaceProjectSource(runtime)
    await relinkWorktreeLinks(db, teamId, source)
    return { workspaces: await listBotTeamLinkableWorkspaces(source) }
  }
})

export const botTeamSetProjectWorkspaceMethod = defineMethod({
  name: 'botTeams.setProjectWorkspace',
  permission: 'workspace',
  params: BotTeamProjectSetWorkspace,
  handler: async ({ projectId, workspaceKey }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    // Why: clearing a link is always allowed, so a team that turned Workspaces off can still unlink.
    if (workspaceKey === null) {
      return { project: db.setBotTeamProjectWorkspace(projectId, null) }
    }
    requireWorkspacesOn(teamNamed(db, db.getBotTeamProject(projectId).teamId))
    const chosen = await findBotTeamWorkspaceProject(workspaceProjectSource(runtime), workspaceKey)
    if (!chosen) {
      throw new Error('That workspace is not on this host. Pick another one.')
    }
    return {
      project: db.setBotTeamProjectWorkspace(projectId, {
        key: chosen.entry.key,
        name: chosen.entry.name
      })
    }
  }
})

export const BOT_TEAM_PROJECT_WORKSPACE_METHODS = [
  botTeamListLinkableWorkspacesMethod,
  botTeamSetProjectWorkspaceMethod
]
