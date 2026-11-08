import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import type {
  MarketplaceServiceConnectArgs,
  MarketplaceServiceDisconnectArgs,
  MarketplaceServicesResult
} from '../../../../shared/marketplace-services'
import {
  MARKETPLACE_SERVICE_CONNECT_METHOD,
  MARKETPLACE_SERVICE_DISCONNECT_METHOD,
  MARKETPLACE_SERVICE_STATUS_METHOD,
  MarketplaceServicesHostAnswerSchema,
  MarketplaceServicesRefusalSchema
} from '../../../../shared/rpc-contract/marketplace-service-params'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

const RPC_TIMEOUT_MS = 60_000
const NEEDS_UPDATE: MarketplaceServicesResult = { ok: false, reason: 'host-needs-update' }
// Why: no vault or source-control calls run inside WSL or over SSH for these services, so those
// hosts answer "not available" instead of this computer's data.
const NOT_ON_HOST: MarketplaceServicesResult = { ok: false, reason: 'unavailable-on-host' }
const FAILED: MarketplaceServicesResult = { ok: false, reason: 'failed' }

function answerOf(value: unknown): MarketplaceServicesResult {
  const ok = MarketplaceServicesHostAnswerSchema.safeParse(value)
  if (ok.success) {
    return {
      ok: true,
      status: {
        hostLabel: ok.data.status.hostLabel,
        store: ok.data.status.store,
        services: ok.data.status.services
      }
    }
  }
  const refused = MarketplaceServicesRefusalSchema.safeParse(value)
  return refused.success
    ? {
        ok: false,
        reason: refused.data.reason,
        ...(refused.data.message === undefined ? {} : { message: refused.data.message })
      }
    : FAILED
}

async function callHost(
  target: MarketplaceVaultHostTarget,
  method: string,
  params: Record<string, unknown> | undefined
): Promise<MarketplaceServicesResult> {
  if (target.kind !== 'runtime') {
    return NOT_ON_HOST
  }
  try {
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      method,
      params,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return answerOf(answer)
  } catch (error) {
    // Why: an older host answers method_not_found, and a phone scoped without the methods answers
    // forbidden; both mean the host predates these services, so the person is told to update it.
    if (
      hasRuntimeRpcErrorCode(error, 'method_not_found') ||
      hasRuntimeRpcErrorCode(error, 'forbidden')
    ) {
      return NEEDS_UPDATE
    }
    // Why: the failure text may carry request details, so only the reason survives.
    return FAILED
  }
}

/** `null` is this computer, answered over IPC; a paired server is asked over its runtime. */
export async function readServicesOnHost(
  target: MarketplaceVaultHostTarget | null
): Promise<MarketplaceServicesResult> {
  if (target !== null) {
    return callHost(target, MARKETPLACE_SERVICE_STATUS_METHOD, undefined)
  }
  try {
    return (await window.api.marketplaceServices?.status()) ?? FAILED
  } catch {
    return FAILED
  }
}

/** Signs in or saves a token on the host. The token is sent once and never read back. */
export async function connectServiceOnHost(
  target: MarketplaceVaultHostTarget | null,
  args: MarketplaceServiceConnectArgs
): Promise<MarketplaceServicesResult> {
  if (target !== null) {
    return callHost(target, MARKETPLACE_SERVICE_CONNECT_METHOD, { ...args })
  }
  try {
    return (await window.api.marketplaceServices?.connect(args)) ?? FAILED
  } catch {
    return FAILED
  }
}

export async function disconnectServiceOnHost(
  target: MarketplaceVaultHostTarget | null,
  args: MarketplaceServiceDisconnectArgs
): Promise<MarketplaceServicesResult> {
  if (target !== null) {
    return callHost(target, MARKETPLACE_SERVICE_DISCONNECT_METHOD, { ...args })
  }
  try {
    return (await window.api.marketplaceServices?.disconnect(args)) ?? FAILED
  } catch {
    return FAILED
  }
}
