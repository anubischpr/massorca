import { getMarketplaceVault } from './marketplace-vault'

/**
 * Env vars the Marketplace adds to agents this host launches; empty when no app is connected.
 * Never throws: a launch must not fail because the vault cannot be read.
 */
export function buildMarketplaceAgentEnv(): Record<string, string> {
  try {
    const vault = getMarketplaceVault()
    // Why: skip the keychain and the key file entirely for hosts that never connected an app.
    return vault.isEmpty() ? {} : vault.buildAgentEnv()
  } catch {
    return {}
  }
}
