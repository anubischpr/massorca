import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import type {
  MarketplaceActionResult,
  MarketplaceAppsApi,
  MarketplaceAppsListResult,
  MarketplaceRemoteAppsApi
} from '../../../../shared/marketplace-apps'
import {
  MARKETPLACE_APPS_HOST_METHODS,
  readMarketplaceActionAnswer,
  readMarketplaceAppsListAnswer,
  type MarketplaceAppsHostCall
} from '../../../../shared/rpc-contract/marketplace-apps-params'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

const RPC_TIMEOUT_MS = 30_000
const NEEDS_UPDATE = { ok: false, reason: 'host-needs-update' } as const

type RemoteCalls = MarketplaceRemoteAppsApi

/** True when the host answered that it has no such method, or a phone scope forbade it. */
function predatesMarketplace(error: unknown): boolean {
  // Why: an older host answers method_not_found, and a phone scoped without the methods answers
  // forbidden; both mean the host predates the Marketplace, so the person is told to update it.
  return (
    hasRuntimeRpcErrorCode(error, 'method_not_found') || hasRuntimeRpcErrorCode(error, 'forbidden')
  )
}

async function listOnHost(target: MarketplaceVaultHostTarget): Promise<MarketplaceAppsListResult> {
  try {
    if (target.kind === 'ssh') {
      const remote = window.api?.marketplaceApps?.remote
      return remote ? await remote.listApps({ connectionId: target.connectionId }) : NEEDS_UPDATE
    }
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      MARKETPLACE_APPS_HOST_METHODS.listApps,
      {},
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return readMarketplaceAppsListAnswer(answer)
  } catch (error) {
    // Why: the failure text may carry request details, so only the reason survives.
    return predatesMarketplace(error) ? NEEDS_UPDATE : { ok: false, reason: 'failed' }
  }
}

async function actOnHost<K extends Exclude<MarketplaceAppsHostCall, 'listApps'>>(
  target: MarketplaceVaultHostTarget,
  call: K,
  args: Parameters<RemoteCalls[K]>[0]['args'],
  viaSsh: (remote: RemoteCalls, connectionId: string) => Promise<MarketplaceActionResult>
): Promise<MarketplaceActionResult> {
  try {
    if (target.kind === 'ssh') {
      const remote = window.api?.marketplaceApps?.remote
      return remote ? await viaSsh(remote, target.connectionId) : NEEDS_UPDATE
    }
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      MARKETPLACE_APPS_HOST_METHODS[call],
      args,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return readMarketplaceActionAnswer(answer)
  } catch (error) {
    return predatesMarketplace(error) ? NEEDS_UPDATE : { ok: false, reason: 'failed' }
  }
}

/** The apps of one host other than this computer; each call runs on that host's own agents. */
export function readHostApps(
  target: MarketplaceVaultHostTarget
): Promise<MarketplaceAppsListResult> {
  return listOnHost(target)
}

/**
 * The Marketplace operations aimed at one host, in the shape the page already uses for this
 * computer, so every action of the page reaches the chosen host without a second code path.
 */
export function createHostMarketplaceAppsApi(
  target: MarketplaceVaultHostTarget
): MarketplaceAppsApi {
  return {
    listApps: async () => {
      const result = await listOnHost(target)
      if (!result.ok) {
        throw new Error(result.reason)
      }
      return result.apps
    },
    connect: (args) =>
      actOnHost(target, 'connect', args, (remote, connectionId) =>
        remote.connect({ connectionId, args })
      ),
    disconnect: (args) =>
      actOnHost(target, 'disconnect', args, (remote, connectionId) =>
        remote.disconnect({ connectionId, args })
      ),
    setOpenMetadataToken: (args) =>
      actOnHost(target, 'setOpenMetadataToken', args, (remote, connectionId) =>
        remote.setOpenMetadataToken({ connectionId, args })
      ),
    addOpenMetadataProfile: (args) =>
      actOnHost(target, 'addOpenMetadataProfile', args, (remote, connectionId) =>
        remote.addOpenMetadataProfile({ connectionId, args })
      ),
    removeOpenMetadataProfile: (args) =>
      actOnHost(target, 'removeOpenMetadataProfile', args, (remote, connectionId) =>
        remote.removeOpenMetadataProfile({ connectionId, args })
      ),
    setEngramServer: (args) =>
      actOnHost(target, 'setEngramServer', args, (remote, connectionId) =>
        remote.setEngramServer({ connectionId, args })
      ),
    setAccessPolicy: (args) =>
      actOnHost(target, 'setAccessPolicy', args, (remote, connectionId) =>
        remote.setAccessPolicy({ connectionId, args })
      )
  }
}
