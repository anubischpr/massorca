import { runProcess } from '../shared/child-process/run-process'
import { MARKETPLACE_APPS_HOST_METHODS } from '../shared/rpc-contract/marketplace-apps-params'
import { createHomeMarketplaceAgentPaths } from '../main/marketplace/marketplace-home-agent-paths'
import { createMarketplaceAppsHostHandlers } from '../main/marketplace/marketplace-apps-host-methods'
import {
  createMarketplaceAppsService,
  type MarketplaceAppsService
} from '../main/marketplace/marketplace-apps-service'
import type { RelayDispatcher } from './dispatcher'
import { resolveCommandPathForRelay } from './preflight-handler'
import { buildRelayCommandEnv } from './relay-command-env'
import { getRelayMarketplaceVault } from './relay-marketplace-vault'

const PROBE_TIMEOUT_MS = 5000

async function probe(
  command: string,
  args: string[]
): Promise<{ found: boolean; code: number | null; stdout: string }> {
  const path = await resolveCommandPathForRelay(command)
  if (!path) {
    return { found: false, code: null, stdout: '' }
  }
  try {
    const result = await runProcess({
      program: path,
      args,
      env: buildRelayCommandEnv(process.env, process.platform),
      timeoutMs: PROBE_TIMEOUT_MS,
      maxOutputBytes: 4096
    })
    return { found: true, code: result.code, stdout: result.stdout }
  } catch {
    return { found: true, code: null, stdout: '' }
  }
}

/** Engram on this host's PATH and, when it answers `engram version`, its version number. */
export async function detectRelayEngramProgram(): Promise<{
  found: boolean
  version: string | null
}> {
  const result = await probe('engram', ['version'])
  const version = result.code === 0 ? /\d+\.\d+\.\d+/.exec(result.stdout)?.[0] : undefined
  return { found: result.found, version: version ?? null }
}

/** Whether `gh` on this host is signed in; false when it is missing or does not answer. */
export async function relayGithubAuthenticated(): Promise<boolean> {
  return (await probe('gh', ['auth', 'status'])).code === 0
}

let relayService: MarketplaceAppsService | null = null

/**
 * This SSH host's own apps service: the writers the desktop uses, over this host's home folder
 * and its own vault, so each agent's config is edited (and backed up) where the agent runs.
 */
export function getRelayMarketplaceAppsService(): MarketplaceAppsService {
  relayService ??= createMarketplaceAppsService({
    vault: getRelayMarketplaceVault(),
    paths: createHomeMarketplaceAgentPaths(),
    engramProgram: detectRelayEngramProgram,
    githubAuthenticated: relayGithubAuthenticated
  })
  return relayService
}

/**
 * Connecting apps on this host. An older relay lacks these methods and answers `method not found`,
 * which the desktop reports as "update MassOrca on this host first". Answers carry no token.
 */
export class MarketplaceAppsHandler {
  constructor(
    dispatcher: RelayDispatcher,
    service: MarketplaceAppsService = getRelayMarketplaceAppsService()
  ) {
    const handlers = createMarketplaceAppsHostHandlers(service)
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.listApps, async () => handlers.listApps())
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.connect, async (params) =>
      handlers.connect(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.disconnect, async (params) =>
      handlers.disconnect(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.setOpenMetadataToken, async (params) =>
      handlers.setOpenMetadataToken(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.addOpenMetadataProfile, async (params) =>
      handlers.addOpenMetadataProfile(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.removeOpenMetadataProfile, async (params) =>
      handlers.removeOpenMetadataProfile(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.setEngramServer, async (params) =>
      handlers.setEngramServer(params)
    )
    dispatcher.onRequest(MARKETPLACE_APPS_HOST_METHODS.setAccessPolicy, async (params) =>
      handlers.setAccessPolicy(params)
    )
  }
}
