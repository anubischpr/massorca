import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { getMarketplaceVault } from './marketplace-vault'

/**
 * Env vars the Marketplace adds to agents this host launches; empty when no app is connected.
 * With the launching agent, an app whose policy keeps that agent out adds none of its vars.
 * Never throws: a launch must not fail because the vault cannot be read.
 */
export function buildMarketplaceAgentEnv(agent?: MarketplaceAppAgent): Record<string, string> {
  try {
    const vault = getMarketplaceVault()
    // Why: skip the keychain and the key file entirely for hosts that never connected an app.
    return vault.isEmpty() ? {} : vault.buildAgentEnv(agent)
  } catch {
    return {}
  }
}
