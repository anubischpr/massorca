import { z } from 'zod'
import { MARKETPLACE_REMOTE_CREDENTIAL_SLOTS } from '../marketplace-apps'

export const MARKETPLACE_VAULT_STATUS_METHOD = 'marketplace.vault.status'
export const MARKETPLACE_VAULT_SET_METHOD = 'marketplace.vault.set'
export const MARKETPLACE_VAULT_CLEAR_METHOD = 'marketplace.vault.clear'
// Why: separate method names, not a wider `slot`: a host that predates profile tokens answers
// `method_not_found` (the capability gate) instead of misreading the slot as invalid input.
export const MARKETPLACE_VAULT_SET_PROFILE_METHOD = 'marketplace.vault.setProfile'
export const MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD = 'marketplace.vault.clearProfile'

const MAX_TOKEN_LENGTH = 8192
const MAX_PROFILE_NAME_LENGTH = 40

/** A token travels renderer to host once; no result or log ever carries it back. */
export const MarketplaceVaultSet = z.object({
  slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS),
  token: z.string().min(1).max(MAX_TOKEN_LENGTH)
})

export const MarketplaceVaultClear = z.object({
  slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS)
})

// Why: these only bound the shape; the host re-checks the name with the local profile parser.
const ProfileName = z.string().min(1).max(MAX_PROFILE_NAME_LENGTH)

export const MarketplaceVaultSetProfile = z.object({
  name: ProfileName,
  token: z.string().min(1).max(MAX_TOKEN_LENGTH)
})

export const MarketplaceVaultClearProfile = z.object({ name: ProfileName })

/** The shape a host answers with; a client keeps only these fields, so nothing else can leak through. */
export const MarketplaceVaultHostStatusSchema = z.object({
  hostLabel: z.string().max(255),
  store: z.enum(['keychain', 'key-file']),
  credentials: z.array(
    z.object({
      slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS),
      stored: z.boolean(),
      updatedAt: z.number().int().nonnegative().optional()
    })
  ),
  // Why: optional, because a host that predates profile tokens never sends it.
  profiles: z
    .array(
      z.object({
        name: ProfileName,
        stored: z.boolean(),
        updatedAt: z.number().int().nonnegative().optional()
      })
    )
    .max(200)
    .optional()
})

export const MarketplaceVaultHostAnswerSchema = z.object({
  ok: z.literal(true),
  status: MarketplaceVaultHostStatusSchema
})
