import { z } from 'zod'
import { MARKETPLACE_SERVICE_IDS } from '../marketplace-services'

// Why: new method names, not wider vault slots: a host that predates them answers `method_not_found`,
// which a client reads as "update MassOrca on this host first".
export const MARKETPLACE_SERVICE_STATUS_METHOD = 'marketplace.service.status'
export const MARKETPLACE_SERVICE_CONNECT_METHOD = 'marketplace.service.connect'
export const MARKETPLACE_SERVICE_DISCONNECT_METHOD = 'marketplace.service.disconnect'

const MAX_TOKEN_LENGTH = 8192
const MAX_URL_LENGTH = 2048
const MAX_EMAIL_LENGTH = 320

const ServiceId = z.enum(MARKETPLACE_SERVICE_IDS)

/** The token is write-only: no result, log or error ever carries it back. */
export const MarketplaceServiceConnect = z.object({
  service: ServiceId,
  token: z.string().min(1).max(MAX_TOKEN_LENGTH),
  baseUrl: z.string().min(1).max(MAX_URL_LENGTH).optional(),
  email: z.string().min(1).max(MAX_EMAIL_LENGTH).optional()
})

export const MarketplaceServiceDisconnect = z.object({ service: ServiceId })

/** The shape a host answers with; a client keeps only these fields, so nothing else can leak through. */
export const MarketplaceServicesHostAnswerSchema = z.object({
  ok: z.literal(true),
  status: z.object({
    hostLabel: z.string().max(255),
    store: z.enum(['keychain', 'key-file']),
    services: z
      .array(
        z.object({
          service: ServiceId,
          source: z.enum(['stored', 'external', 'none']),
          updatedAt: z.number().int().nonnegative().optional(),
          account: z.string().max(255).optional(),
          baseUrl: z.string().max(MAX_URL_LENGTH).optional(),
          cliInstalled: z.boolean().optional(),
          credentialProtection: z.enum(['sealed', 'plaintext']).nullable().optional()
        })
      )
      .max(32)
  })
})

/** What a host answers when it refuses a call; the client keeps only the reason and a short sentence. */
export const MarketplaceServicesRefusalSchema = z.object({
  ok: z.literal(false),
  reason: z.enum([
    'invalid-input',
    'vault-unavailable',
    'rejected',
    'unreachable',
    'host-needs-update',
    'unavailable-on-host',
    'failed'
  ]),
  message: z.string().max(300).optional()
})
