import { botTeamIdFromFolderPath } from '../../../../shared/bot-team-folder'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

/**
 * The team a team folder belongs to, from the team list; null while the list is not loaded, or when
 * the folder is not a team's or its team is gone.
 */
export function botTeamForFolderPath(
  teams: readonly BotTeam[] | null,
  workspacePath: string
): BotTeam | null {
  const teamId = botTeamIdFromFolderPath(workspacePath)
  return teamId === null ? null : (teams?.find((team) => team.id === teamId) ?? null)
}
