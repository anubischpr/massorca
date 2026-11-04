import { resolveCommandOnLocalPath } from '../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../ipc/preflight-local-env'
import { runPreflightCheck } from '../preflight/agent-detection'
import { runProcess } from '../../shared/child-process/run-process'
import { defaultMarketplaceAgentPaths } from './marketplace-agent-paths'
import {
  createMarketplaceAppsService,
  type MarketplaceAppsService
} from './marketplace-apps-service'
import { getMarketplaceVault } from './marketplace-vault'

const VERSION_TIMEOUT_MS = 5000

/** Engram on this computer's PATH and, when it answers `engram version`, its version number. */
export async function detectEngramProgram(): Promise<{ found: boolean; version: string | null }> {
  const path = await resolveCommandOnLocalPath('engram', { env: buildLocalPreflightEnv() })
  if (!path) {
    return { found: false, version: null }
  }
  try {
    const result = await runProcess({
      program: path,
      args: ['version'],
      timeoutMs: VERSION_TIMEOUT_MS,
      maxOutputBytes: 4096
    })
    const version = result.code === 0 ? /\d+\.\d+\.\d+/.exec(result.stdout)?.[0] : undefined
    return { found: true, version: version ?? null }
  } catch {
    return { found: true, version: null }
  }
}

let defaultService: MarketplaceAppsService | null = null

/**
 * This host's one service. The desktop's own page and the paired-server methods share it, so their
 * read-modify-write of the same agent files and state runs through a single queue.
 */
export function createDefaultMarketplaceAppsService(): MarketplaceAppsService {
  defaultService ??= createMarketplaceAppsService({
    vault: getMarketplaceVault(),
    paths: defaultMarketplaceAgentPaths,
    engramProgram: detectEngramProgram,
    githubAuthenticated: async () => (await runPreflightCheck()).gh.authenticated
  })
  return defaultService
}
