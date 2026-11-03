import { homedir } from 'node:os'
import path from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { BOT_TEAMS_FOLDER_NAME } from '../../shared/bot-team-folder'
import type { BotTeamSnapshotDeps } from './bot-team-snapshot-types'

/** The folder every team's folder lives in, on the host that runs the bots. */
export function botTeamsParentPath(): string {
  return path.join(homedir(), BOT_TEAMS_FOLDER_NAME)
}

export function botTeamFolderPath(teamId: string): string {
  return path.join(botTeamsParentPath(), teamId)
}

/** Where a team's versions are kept: next to the app's data, never in the team's folder. */
export function botTeamVersionDeps(teamId: string): BotTeamSnapshotDeps {
  return {
    folder: botTeamFolderPath(teamId),
    storeDir: path.join(getAppEnvironment().getPath('userData'), 'bot-team-versions', teamId)
  }
}
