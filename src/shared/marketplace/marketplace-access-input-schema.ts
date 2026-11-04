import { z } from 'zod'
import { MARKETPLACE_ACCESS_MODES, MARKETPLACE_APP_AGENTS } from '../marketplace-apps'

/** Most agents, bots or teams one policy may name. */
export const MAX_ACCESS_PICKS = 500
const MAX_ACCESS_ID_LENGTH = 200

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
