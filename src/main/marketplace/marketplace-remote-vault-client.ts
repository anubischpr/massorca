import { z } from 'zod'
import {
  MARKETPLACE_REMOTE_CREDENTIAL_SLOTS,
  type MarketplaceVaultHostResult
} from '../../shared/marketplace-apps'
import {
  MARKETPLACE_VAULT_CLEAR_METHOD,
  MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD,
  MARKETPLACE_VAULT_SET_METHOD,
  MARKETPLACE_VAULT_SET_PROFILE_METHOD,
  MARKETPLACE_VAULT_STATUS_METHOD,
  MarketplaceVaultHostAnswerSchema
} from '../../shared/rpc-contract/marketplace-vault-params'
import { parseProfileName, parseToken } from './marketplace-apps-args'

/** The slice of the SSH multiplexer this client needs. */
export type RemoteVaultMux = {
  isDisposed: () => boolean
  request: (method: string, params?: Record<string, unknown>) => Promise<unknown>
}

const METHOD_NOT_FOUND = -32601
const ConnectionArgs = z.object({ connectionId: z.string().min(1).max(512) })
const SlotArgs = ConnectionArgs.extend({ slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS) })
// Why: a `profile` argument selects the profile methods, which an older relay answers as method-not-found.
const ProfileArgs = ConnectionArgs.extend({ profile: z.string() })

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

export type RemoteVaultClient = {
  status: (args: unknown) => Promise<MarketplaceVaultHostResult>
  set: (args: unknown) => Promise<MarketplaceVaultHostResult>
  clear: (args: unknown) => Promise<MarketplaceVaultHostResult>
}

const INVALID: MarketplaceVaultHostResult = { ok: false, reason: 'invalid-input' }

/**
 * Sets or replaces a token on an SSH host's own vault. The token goes out once; the answer is
 * rebuilt from the fields we know, and a failure never repeats any part of the request.
 */
export function createRemoteVaultClient(
  getMux: (connectionId: string) => RemoteVaultMux | undefined
): RemoteVaultClient {
  const call = async (
    connectionId: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<MarketplaceVaultHostResult> => {
    const mux = getMux(connectionId)
    if (!mux || mux.isDisposed()) {
      return { ok: false, reason: 'unreachable' }
    }
    try {
      const answer = await mux.request(method, params)
      const parsed = MarketplaceVaultHostAnswerSchema.safeParse(answer)
      if (parsed.success) {
        return { ok: true, status: parsed.data.status }
      }
      const reason = z.object({ reason: z.string() }).safeParse(answer)
      return {
        ok: false,
        reason:
          reason.success && reason.data.reason === 'vault-unavailable'
            ? 'vault-unavailable'
            : reason.success && reason.data.reason === 'invalid-input'
              ? 'invalid-input'
              : 'failed'
      }
    } catch (error) {
      // Why: a relay that predates the vault answers method-not-found; that is the capability gate.
      const code = errorCode(error)
      if (code === METHOD_NOT_FOUND) {
        return { ok: false, reason: 'host-needs-update' }
      }
      return { ok: false, reason: code === 'CONNECTION_LOST' ? 'unreachable' : 'failed' }
    }
  }

  return {
    status: (rawArgs) => {
      const args = ConnectionArgs.safeParse(rawArgs)
      return args.success
        ? call(args.data.connectionId, MARKETPLACE_VAULT_STATUS_METHOD, {})
        : Promise.resolve(INVALID)
    },
    set: (rawArgs) => {
      const profile = ProfileArgs.extend({ token: z.unknown() }).safeParse(rawArgs)
      if (profile.success) {
        const name = parseProfileName(profile.data.profile)
        const token = parseToken(profile.data.token)
        return name && token
          ? call(profile.data.connectionId, MARKETPLACE_VAULT_SET_PROFILE_METHOD, { name, token })
          : Promise.resolve(INVALID)
      }
      const args = SlotArgs.extend({ token: z.unknown() }).safeParse(rawArgs)
      const token = args.success ? parseToken(args.data.token) : null
      return args.success && token
        ? call(args.data.connectionId, MARKETPLACE_VAULT_SET_METHOD, {
            slot: args.data.slot,
            token
          })
        : Promise.resolve(INVALID)
    },
    clear: (rawArgs) => {
      const profile = ProfileArgs.safeParse(rawArgs)
      if (profile.success) {
        const name = parseProfileName(profile.data.profile)
        return name
          ? call(profile.data.connectionId, MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD, { name })
          : Promise.resolve(INVALID)
      }
      const args = SlotArgs.safeParse(rawArgs)
      return args.success
        ? call(args.data.connectionId, MARKETPLACE_VAULT_CLEAR_METHOD, { slot: args.data.slot })
        : Promise.resolve(INVALID)
    }
  }
}
