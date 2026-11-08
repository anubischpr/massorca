import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import type {
  MarketplaceVaultHostResult,
  MarketplaceVaultSlot
} from '../../../../shared/marketplace-apps'
import {
  MARKETPLACE_VAULT_CLEAR_METHOD,
  MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD,
  MARKETPLACE_VAULT_SET_METHOD,
  MARKETPLACE_VAULT_SET_PROFILE_METHOD,
  MARKETPLACE_VAULT_STATUS_METHOD,
  MarketplaceVaultHostAnswerSchema
} from '../../../../shared/rpc-contract/marketplace-vault-params'

/** A host other than this computer that keeps its own vault for the agents it runs. */
export type MarketplaceVaultHostTarget =
  | { kind: 'ssh'; connectionId: string; label: string }
  | { kind: 'runtime'; environmentId: string; label: string }
  | { kind: 'wsl'; distro: string; label: string }

const RPC_TIMEOUT_MS = 30_000
const NEEDS_UPDATE: MarketplaceVaultHostResult = { ok: false, reason: 'host-needs-update' }
// Why: no vault runs inside WSL yet, so a distro answers failed rather than with this computer's vault.
const WSL_UNAVAILABLE: MarketplaceVaultHostResult = { ok: false, reason: 'failed' }

function answerOf(value: unknown): MarketplaceVaultHostResult {
  const parsed = MarketplaceVaultHostAnswerSchema.safeParse(value)
  return parsed.success ? { ok: true, status: parsed.data.status } : { ok: false, reason: 'failed' }
}

/** One vault call on one host. A host without the methods reads as "update it first", never a crash. */
async function callHost(
  target: MarketplaceVaultHostTarget,
  method: string,
  params: Record<string, unknown>,
  viaSsh: () => Promise<MarketplaceVaultHostResult> | undefined
): Promise<MarketplaceVaultHostResult> {
  if (target.kind === 'wsl') {
    return WSL_UNAVAILABLE
  }
  try {
    if (target.kind === 'ssh') {
      return (await viaSsh()) ?? NEEDS_UPDATE
    }
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      method,
      params,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return answerOf(answer)
  } catch (error) {
    // Why: an older host answers method_not_found, and a phone scoped without the methods answers
    // forbidden; both mean the host predates the vault, so the person is told to update it.
    if (
      hasRuntimeRpcErrorCode(error, 'method_not_found') ||
      hasRuntimeRpcErrorCode(error, 'forbidden')
    ) {
      return NEEDS_UPDATE
    }
    // Why: the failure text may carry request details, so only the reason survives.
    return { ok: false, reason: 'failed' }
  }
}

export function readVaultHost(
  target: MarketplaceVaultHostTarget
): Promise<MarketplaceVaultHostResult> {
  return callHost(target, MARKETPLACE_VAULT_STATUS_METHOD, {}, () =>
    target.kind === 'ssh'
      ? window.api.marketplaceApps.remoteVault?.status({ connectionId: target.connectionId })
      : undefined
  )
}

/**
 * Sets or replaces a token on the host. The token is sent once and never read back. A profile
 * goes through its own method, so a host that predates profile tokens answers "update it first".
 */
export function setVaultHostToken(
  target: MarketplaceVaultHostTarget,
  slot: MarketplaceVaultSlot,
  token: string
): Promise<MarketplaceVaultHostResult> {
  if (typeof slot !== 'string') {
    return callHost(target, MARKETPLACE_VAULT_SET_PROFILE_METHOD, { name: slot.name, token }, () =>
      target.kind === 'ssh'
        ? window.api.marketplaceApps.remoteVault?.set({
            connectionId: target.connectionId,
            profile: slot.name,
            token
          })
        : undefined
    )
  }
  return callHost(target, MARKETPLACE_VAULT_SET_METHOD, { slot, token }, () =>
    target.kind === 'ssh'
      ? window.api.marketplaceApps.remoteVault?.set({
          connectionId: target.connectionId,
          slot,
          token
        })
      : undefined
  )
}

export function clearVaultHostToken(
  target: MarketplaceVaultHostTarget,
  slot: MarketplaceVaultSlot
): Promise<MarketplaceVaultHostResult> {
  if (typeof slot !== 'string') {
    return callHost(target, MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD, { name: slot.name }, () =>
      target.kind === 'ssh'
        ? window.api.marketplaceApps.remoteVault?.clear({
            connectionId: target.connectionId,
            profile: slot.name
          })
        : undefined
    )
  }
  return callHost(target, MARKETPLACE_VAULT_CLEAR_METHOD, { slot }, () =>
    target.kind === 'ssh'
      ? window.api.marketplaceApps.remoteVault?.clear({
          connectionId: target.connectionId,
          slot
        })
      : undefined
  )
}
