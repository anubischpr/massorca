import { z } from 'zod'

/** The host's connected Marketplace apps an @ menu can name: id and name only, never URLs or credentials. */
export const BotTeamConnectedAppsResult = z.object({
  apps: z.array(z.object({ id: z.string(), name: z.string() }))
})
export type BotTeamConnectedAppsResult = z.infer<typeof BotTeamConnectedAppsResult>
