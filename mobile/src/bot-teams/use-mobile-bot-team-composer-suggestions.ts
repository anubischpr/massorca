import { useCallback, useMemo } from 'react'
import type { BotTeamMentionProject } from '../../../src/shared/bot-team-composer-menu'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamRoomSuggestions } from './MobileBotTeamRoomSuggestions'
import { useBotTeamMentionApps } from './use-mobile-bot-team-mention-apps'

/**
 * The room composer's @ menu over the room team's bots, the other teams, the projects, the files
 * and the host's connected apps, with those apps for the room's pills and chips.
 */
export function useBotTeamComposerSuggestions(
  client: Pick<RpcClient, 'sendRequest'>,
  team: BotTeam,
  teams: readonly BotTeam[],
  projects: readonly BotTeamMentionProject[],
  files: readonly string[],
  offline: boolean
) {
  const apps = useBotTeamMentionApps(client, team.id, offline)
  const otherTeams = useMemo(() => teams.filter((entry) => entry.id !== team.id), [teams, team])
  const suggest = useCallback(
    (composerText: string, cursor: number) =>
      botTeamRoomSuggestions({
        text: composerText,
        caret: cursor,
        team,
        otherTeams,
        projects,
        files,
        apps
      }),
    [team, otherTeams, projects, files, apps]
  )
  return { suggest, apps }
}
