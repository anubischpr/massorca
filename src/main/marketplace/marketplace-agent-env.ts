import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defaultMarketplaceVaultDir, getMarketplaceVault } from './marketplace-vault'

/**
 * Env vars the Marketplace adds to agents MassOrca launches; empty when no app is connected.
 * Never throws: a launch must not fail because the vault cannot be read.
 */
export function buildMarketplaceAgentEnv(): Record<string, string> {
  try {
    // Why: skip the keyring entirely for people who never connected an app.
    if (!existsSync(join(defaultMarketplaceVaultDir(), 'state.json'))) {
      return {}
    }
    return getMarketplaceVault().buildAgentEnv()
  } catch {
    return {}
  }
}
