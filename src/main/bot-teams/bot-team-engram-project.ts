import { parseBotTeamProjectKey } from '../../shared/bot-team-project-workspace-key'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../shared/rpc-contract/bot-team-room-params'

/** The folder name at the end of a path, whichever separator the host uses. */
function folderName(path: string): string {
  const parts = path.split('\\').join('/').split('/').filter(Boolean)
  return parts.at(-1) ?? ''
}

/**
 * The Engram project a bot project reads: its linked repo's folder name, else the linked
 * project's name. Null when workspaces are off or nothing is linked; never another project.
 */
export function engramProjectName(
  team: Pick<BotTeam, 'workspacesEnabled'>,
  project: Pick<BotTeamProject, 'workspace'>,
  repos: readonly { id: string; path: string }[]
): string | null {
  if (!team.workspacesEnabled || !project.workspace) {
    return null
  }
  const ref = parseBotTeamProjectKey(project.workspace.key)
  const repo = ref?.type === 'repo' ? repos.find((entry) => entry.id === ref.id) : undefined
  return folderName(repo?.path ?? '').trim() || project.workspace.name.trim() || null
}
