import { z } from 'zod'
import {
  MARKETPLACE_ACCESS_MODES,
  MARKETPLACE_APP_AGENTS,
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppAgent,
  type MarketplaceAppId
} from '../../shared/marketplace-apps'

/** Most agents, bots or teams one policy may name. */
export const MAX_ACCESS_PICKS = 500
const MAX_ACCESS_ID_LENGTH = 200

/** One policy per app; GitHub's only shows in MassOrca and is never written into an agent config. */
export type MarketplaceAccessByApp = Record<MarketplaceAppId, MarketplaceAppAccessPolicy>

export function everyoneAccessByApp(): MarketplaceAccessByApp {
  return {
    engram: everyoneAccessPolicy(),
    openmetadata: everyoneAccessPolicy(),
    github: everyoneAccessPolicy()
  }
}

function allDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

const pickedIds = z
  .array(z.string().min(1).max(MAX_ACCESS_ID_LENGTH))
  .max(MAX_ACCESS_PICKS)
  .refine(allDistinct)

/** A policy a client sends: every field is checked, and an unknown agent is an error. */
export const accessPolicyInputSchema = z.object({
  agents: z.object({
    mode: z.enum(MARKETPLACE_ACCESS_MODES),
    ids: z
      .array(z.enum(MARKETPLACE_APP_AGENTS))
      .max(MARKETPLACE_APP_AGENTS.length)
      .refine(allDistinct)
  }),
  bots: z.object({
    mode: z.enum(MARKETPLACE_ACCESS_MODES),
    botIds: pickedIds,
    teamIds: pickedIds
  })
})

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

/** The access records in state.json; a state file from before access policies reads as Everyone. */
export const storedAccessSchema = z
  .object({ engram: storedPolicy, openmetadata: storedPolicy, github: storedPolicy })
  .catch(() => everyoneAccessByApp())
