import { z } from 'zod'
import type { RpcResponse } from '../transport/types'
import type {
  MarketplaceActionResult,
  MarketplaceAppAccessPolicy,
  MarketplaceAppId,
  MarketplaceAppsListResult
} from '../../../src/shared/marketplace-apps'
import {
  readMarketplaceActionAnswer,
  readMarketplaceAppsListAnswer
} from '../../../src/shared/rpc-contract/marketplace-apps-params'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import { readPiRuntimeReport } from '../create-session/create-session-agent-choices'

/** The one call these readers make; a connected host client satisfies it. */
export type MarketplaceHostRpc = {
  sendRequest: (method: string, params?: unknown) => Promise<RpcResponse>
}

export type HostToolState = {
  git: boolean
  gh: { installed: boolean; authenticated: boolean }
  glab: { installed: boolean; authenticated: boolean } | null
}

const PreflightSchema = z.object({
  git: z.object({ installed: z.boolean() }),
  gh: z.object({ installed: z.boolean(), authenticated: z.boolean() }),
  glab: z.object({ installed: z.boolean(), authenticated: z.boolean() }).optional()
})

const AgentIdsSchema = z.array(z.string())

// Why: a call that never gets an answer reads as a failed call, so no reader below throws.
function settle(pending: Promise<RpcResponse>): Promise<RpcResponse | null> {
  return pending.catch(() => null)
}

function actionAnswer(response: RpcResponse | null): MarketplaceActionResult {
  if (response === null || !response.ok) {
    return { ok: false, reason: 'failed' }
  }
  return readMarketplaceActionAnswer(response.result)
}

export async function listMarketplaceApps(
  client: MarketplaceHostRpc
): Promise<MarketplaceAppsListResult> {
  const response = await settle(client.sendRequest('marketplace.apps.list'))
  if (response === null || !response.ok) {
    return { ok: false, reason: 'failed' }
  }
  return readMarketplaceAppsListAnswer(response.result)
}

/** Connects OpenMetadata with its server address and token; the token travels once. */
export async function connectOpenMetadata(
  client: MarketplaceHostRpc,
  args: { url: string; token: string }
): Promise<MarketplaceActionResult> {
  return actionAnswer(
    await settle(
      client.sendRequest('marketplace.apps.connect', {
        id: 'openmetadata',
        url: args.url,
        token: args.token
      })
    )
  )
}

export async function setOpenMetadataToken(
  client: MarketplaceHostRpc,
  token: string
): Promise<MarketplaceActionResult> {
  return actionAnswer(
    await settle(client.sendRequest('marketplace.apps.setOpenMetadataToken', { token }))
  )
}

export async function setEngramServer(
  client: MarketplaceHostRpc,
  args: { url: string; token: string }
): Promise<MarketplaceActionResult> {
  return actionAnswer(
    await settle(
      client.sendRequest('marketplace.apps.setEngramServer', { url: args.url, token: args.token })
    )
  )
}

/** Saves who may use an app on the host; build the policy with src/shared/marketplace-access-edit. */
export async function setMarketplaceAppAccess(
  client: MarketplaceHostRpc,
  appId: MarketplaceAppId,
  policy: MarketplaceAppAccessPolicy
): Promise<MarketplaceActionResult> {
  return actionAnswer(
    await settle(client.sendRequest('marketplace.apps.setAccessPolicy', { id: appId, policy }))
  )
}

/** Whether git, GitHub CLI and (when the host reports it) GitLab CLI are installed and signed in. */
export async function readHostTools(client: MarketplaceHostRpc): Promise<HostToolState | null> {
  const response = await settle(client.sendRequest('preflight.check', {}))
  if (response === null || !response.ok) {
    return null
  }
  const parsed = PreflightSchema.safeParse(response.result)
  if (!parsed.success) {
    return null
  }
  return { git: parsed.data.git.installed, gh: parsed.data.gh, glab: parsed.data.glab ?? null }
}

export async function readHostAgentIds(
  client: MarketplaceHostRpc
): Promise<ReadonlySet<string> | null> {
  const response = await settle(client.sendRequest('preflight.detectAgents'))
  if (response === null || !response.ok) {
    return null
  }
  const parsed = AgentIdsSchema.safeParse(response.result)
  return parsed.success ? new Set(parsed.data) : null
}

export async function readHostPiRuntimes(
  client: MarketplaceHostRpc
): Promise<readonly PiRuntimeSelection[] | null> {
  const response = await settle(client.sendRequest('preflight.detectPiRuntimes'))
  return response !== null && response.ok ? readPiRuntimeReport(response.result) : null
}
