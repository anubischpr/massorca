import { z } from 'zod'
import { MARKETPLACE_REMOTE_CREDENTIAL_SLOTS } from '../marketplace-apps'

export const MARKETPLACE_VAULT_STATUS_METHOD = 'marketplace.vault.status'
export const MARKETPLACE_VAULT_SET_METHOD = 'marketplace.vault.set'
export const MARKETPLACE_VAULT_CLEAR_METHOD = 'marketplace.vault.clear'

const MAX_TOKEN_LENGTH = 8192

/** A token travels renderer to host once; no result or log ever carries it back. */
export const MarketplaceVaultSet = z.object({
  slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS),
  token: z.string().min(1).max(MAX_TOKEN_LENGTH)
})

export const MarketplaceVaultClear = z.object({
  slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS)
})

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
  )
})

export const MarketplaceVaultHostAnswerSchema = z.object({
  ok: z.literal(true),
  status: MarketplaceVaultHostStatusSchema
})
