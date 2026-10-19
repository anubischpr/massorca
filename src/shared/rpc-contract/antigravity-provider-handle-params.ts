import { z } from 'zod'
import { Identifier } from './structured-agent-session-identifiers'

/** A conversation an Antigravity structured chat is pinned to: the `agy --conversation` id. */
export const AntigravityProviderHandle = z
  .object({
    kind: z.literal('antigravity'),
    conversationId: Identifier('Invalid conversation id')
  })
  .strict()
