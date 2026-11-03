import path from 'node:path'
import {
  BotTeamProjectFilesSelector,
  type BotTeamProjectFiles
} from '../../../../shared/rpc-contract/bot-team-files-project-params'
import {
  botTeamDeliverableStoreDir,
  listTeamProjectDeliverables
} from '../../../bot-teams/bot-team-deliverables-record'
import { isMobileBinaryPath } from '../../runtime-file-command-host'
import { defineMethod } from '../core'

export const BOT_TEAM_PROJECT_FILES_METHODS = [
  defineMethod({
    name: 'botTeams.projectFiles',
    permission: 'workspace',
    params: BotTeamProjectFilesSelector,
    handler: async ({ teamId }, ctx): Promise<BotTeamProjectFiles> => {
      const db = ctx.runtime.getOrchestrationDb()
      // Why: a team's tasks can run in a project another team owns, so linked projects count too.
      const projects = db
        .listBotTeamProjects(teamId, { includeLinked: true })
        .filter((project) => project.archivedAt == null)
      const listed = await listTeamProjectDeliverables({
        storeDir: botTeamDeliverableStoreDir(),
        teamId,
        projects: projects.map((project) => ({ projectId: project.id, name: project.name }))
      })
      return {
        projects: listed.projects.map((section) => ({
          projectId: section.projectId,
          name: section.name,
          files: section.files.map((file) => ({
            workspaceId: file.workspaceId,
            relativePath: file.relativePath,
            basename: path.basename(file.relativePath),
            kind: isMobileBinaryPath(file.relativePath) ? 'binary' : 'text'
          }))
        })),
        truncated: listed.truncated
      }
    }
  })
]
