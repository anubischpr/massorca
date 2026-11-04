import { useCallback, useMemo } from 'react'
import type { BotTeamMentionProject } from '../../../src/shared/bot-team-composer-menu'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { botTeamRoomSuggestions } from './MobileBotTeamRoomSuggestions'

/** The room composer's @ menu over the room team's bots, the other teams, the projects and the files. */
export function useBotTeamComposerSuggestions(
  team: BotTeam,
  teams: readonly BotTeam[],
  projects: readonly BotTeamMentionProject[],
  files: readonly string[]
) {
  const otherTeams = useMemo(() => teams.filter((entry) => entry.id !== team.id), [teams, team])
  return useCallback(
    (composerText: string, cursor: number) =>
      botTeamRoomSuggestions({
        text: composerText,
        caret: cursor,
        team,
        otherTeams,
        projects,
        files
      }),
    [team, otherTeams, projects, files]
  )
}
