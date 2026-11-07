import { z } from 'zod'

/** A phone that names the room's team gets the apps at least one of its bots may use; older phones send none. */
export const BotTeamConnectedAppsParams = z.object({ teamId: z.string().optional() })

/** The host's connected Marketplace apps an @ menu can name: id and name only, never URLs or credentials. */
export const BotTeamConnectedAppsResult = z.object({
  apps: z.array(z.object({ id: z.string(), name: z.string() }))
})
export type BotTeamConnectedAppsResult = z.infer<typeof BotTeamConnectedAppsResult>
