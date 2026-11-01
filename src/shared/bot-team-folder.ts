/** Teams' folders live under this folder in the host's home. */
export const BOT_TEAMS_FOLDER_NAME = 'MassOrca Bot Teams'

/** Whether a workspace path is a team's folder, on any host's path style. */
export function isBotTeamFolderPath(workspacePath: string): boolean {
  return workspacePath.split(/[\\/]/).includes(BOT_TEAMS_FOLDER_NAME)
}
