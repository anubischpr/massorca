import { z } from 'zod'
import type {
  MarketplaceActionResult,
  MarketplaceAppsListResult
} from '../../shared/marketplace-apps'
import {
  MARKETPLACE_APPS_HOST_METHODS,
  readMarketplaceActionAnswer,
  readMarketplaceAppsListAnswer,
  type MarketplaceAppsHostCall
} from '../../shared/rpc-contract/marketplace-apps-params'
import type { RemoteVaultMux } from './marketplace-remote-vault-client'

const METHOD_NOT_FOUND = -32601
const ConnectionArgs = z.object({ connectionId: z.string().min(1).max(512) })
const ActionArgs = ConnectionArgs.extend({ args: z.record(z.string(), z.unknown()) })

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

export type RemoteAppsClient = {
  listApps: (call: unknown) => Promise<MarketplaceAppsListResult>
} & Record<
  Exclude<MarketplaceAppsHostCall, 'listApps'>,
  (call: unknown) => Promise<MarketplaceActionResult>
>

/**
 * Runs the Marketplace operations on an SSH host's own relay, so its agents' configs are edited
 * there. A token goes out once; every answer is rebuilt from known fields, and a failure never
 * repeats any part of the request.
 */
export function createRemoteAppsClient(
  getMux: (connectionId: string) => RemoteVaultMux | undefined
): RemoteAppsClient {
  const send = async (
    connectionId: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<
    | { ok: true; answer: unknown }
    | { ok: false; reason: 'host-needs-update' | 'unreachable' | 'failed' }
  > => {
    const mux = getMux(connectionId)
    if (!mux || mux.isDisposed()) {
      return { ok: false, reason: 'unreachable' }
    }
    try {
      return { ok: true, answer: await mux.request(method, params) }
    } catch (error) {
      // Why: a relay that predates the Marketplace answers method-not-found; that is the capability gate.
      const code = errorCode(error)
      if (code === METHOD_NOT_FOUND) {
        return { ok: false, reason: 'host-needs-update' }
      }
      return { ok: false, reason: code === 'CONNECTION_LOST' ? 'unreachable' : 'failed' }
    }
  }

  const action =
    (call: Exclude<MarketplaceAppsHostCall, 'listApps'>) =>
    async (rawCall: unknown): Promise<MarketplaceActionResult> => {
      const parsed = ActionArgs.safeParse(rawCall)
      if (!parsed.success) {
        return { ok: false, reason: 'invalid-input' }
      }
      const sent = await send(
        parsed.data.connectionId,
        MARKETPLACE_APPS_HOST_METHODS[call],
        parsed.data.args
      )
      return sent.ok ? readMarketplaceActionAnswer(sent.answer) : sent
    }

  return {
    listApps: async (rawCall) => {
      const parsed = ConnectionArgs.safeParse(rawCall)
      if (!parsed.success) {
        return { ok: false, reason: 'failed' }
      }
      const sent = await send(parsed.data.connectionId, MARKETPLACE_APPS_HOST_METHODS.listApps, {})
      return sent.ok ? readMarketplaceAppsListAnswer(sent.answer) : sent
    },
    connect: action('connect'),
    disconnect: action('disconnect'),
    setOpenMetadataToken: action('setOpenMetadataToken'),
    addOpenMetadataProfile: action('addOpenMetadataProfile'),
    removeOpenMetadataProfile: action('removeOpenMetadataProfile'),
    setEngramServer: action('setEngramServer'),
    setAccessPolicy: action('setAccessPolicy')
  }
}
