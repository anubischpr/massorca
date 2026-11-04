import { z } from 'zod'
import {
  MARKETPLACE_ACCESS_MODES,
  MARKETPLACE_APP_AGENTS,
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppAgent,
  type MarketplaceAppId
} from '../../shared/marketplace-apps'
import {
  MAX_ACCESS_PICKS,
  accessPolicyInputSchema
} from '../../shared/marketplace/marketplace-access-input-schema'

// Why: the schema lives in shared so a remote host's contract validates with the same rules.
export { MAX_ACCESS_PICKS, accessPolicyInputSchema }

/** One policy per app; GitHub's only shows in MassOrca and is never written into an agent config. */
export type MarketplaceAccessByApp = Record<MarketplaceAppId, MarketplaceAppAccessPolicy>

export function everyoneAccessByApp(): MarketplaceAccessByApp {
  return {
    engram: everyoneAccessPolicy(),
    openmetadata: everyoneAccessPolicy(),
    github: everyoneAccessPolicy()
  }
}

function isKnownAgent(value: string): value is MarketplaceAppAgent {
  return MARKETPLACE_APP_AGENTS.some((agent) => agent === value)
}

const storedPolicySchema = z.object({
  agents: z.object({
    mode: z.enum(MARKETPLACE_ACCESS_MODES),
    // Why: a newer MassOrca may have named an agent this one lacks; only that name is dropped.
    ids: z.array(z.string()).transform((ids) => ids.filter(isKnownAgent))
  }),
  bots: z.object({
    mode: z.enum(MARKETPLACE_ACCESS_MODES),
    botIds: z.array(z.string()),
    teamIds: z.array(z.string())
  })
})

// Why: an unreadable record falls back to Everyone for its app alone, so the rest of the state survives.
const storedPolicy = storedPolicySchema.catch(() => everyoneAccessPolicy())

/** The access records for a bot run's denial: absent reads as Everyone, an unreadable record throws. */
export const storedAccessStrictSchema = z
  .object({
    engram: storedPolicySchema,
    openmetadata: storedPolicySchema,
    github: storedPolicySchema
  })
  .optional()

/** The access records in state.json; a state file from before access policies reads as Everyone. */
export const storedAccessSchema = z
  .object({ engram: storedPolicy, openmetadata: storedPolicy, github: storedPolicy })
  .catch(() => everyoneAccessByApp())
