import { z } from 'zod'
import { BOT_TEAM_CHARACTERS } from './bot-team-params'

/** Bot-team sessions on a host, keyed by session id; a session absent here is not a bot-team session. */
export const BotTeamSessionTeamsResult = z.object({
  sessionTeams: z.record(
    z.string(),
    z.object({
      teamId: z.string(),
      teamName: z.string(),
      character: z.enum(BOT_TEAM_CHARACTERS)
    })
  )
})
export type BotTeamSessionTeamsResult = z.infer<typeof BotTeamSessionTeamsResult>
