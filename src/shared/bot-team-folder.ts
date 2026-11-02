/** Teams' folders live under this folder in the host's home. */
export const BOT_TEAMS_FOLDER_NAME = 'MassOrca Bot Teams'

const PATH_SEPARATOR = /[\\/]/

/** Whether a workspace path is a team's folder, on any host's path style. */
export function isBotTeamFolderPath(workspacePath: string): boolean {
  return workspacePath.split(PATH_SEPARATOR).includes(BOT_TEAMS_FOLDER_NAME)
}

/** The team a team's folder belongs to: the segment after the teams folder, or null. */
export function botTeamIdFromFolderPath(workspacePath: string): string | null {
  const segments = workspacePath.split(PATH_SEPARATOR)
  const index = segments.indexOf(BOT_TEAMS_FOLDER_NAME)
  return index === -1 ? null : segments[index + 1] || null
}

/** A team's folder shows in Workspaces only while its team has the Workspaces option on. */
export function isBotTeamFolderShown(
  workspacePath: string,
  workspacesOnTeamIds: ReadonlySet<string>
): boolean {
  if (!isBotTeamFolderPath(workspacePath)) {
    return true
  }
  const teamId = botTeamIdFromFolderPath(workspacePath)
  return teamId !== null && workspacesOnTeamIds.has(teamId)
}
