import { isBotTeamFolderPath, isBotTeamFolderShown } from '../../../../shared/bot-team-folder'

/**
 * Whether a folder path shows in Workspaces. Only a team's folder is gated: it needs
 * "Show bot teams" on and its team's own Workspaces option on.
 */
export function isBotTeamFolderVisibleInWorkspaces(
  workspacePath: string,
  workspacesOnTeamIds: ReadonlySet<string>,
  showBotTeams: boolean
): boolean {
  if (!isBotTeamFolderPath(workspacePath)) {
    return true
  }
  return showBotTeams && isBotTeamFolderShown(workspacePath, workspacesOnTeamIds)
}
