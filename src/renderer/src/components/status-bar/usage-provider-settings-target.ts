import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'

export function getUsageProviderAccountsSectionId(
  provider: ProviderRateLimits['provider']
): string | null {
  switch (provider) {
    case 'claude':
      return 'accounts-claude'
    case 'codex':
      return 'accounts-codex'
    case 'gemini':
      return 'accounts-gemini'
    case 'opencode-go':
      return 'accounts-opencode-go'
    case 'minimax':
      return 'accounts-minimax'
    case 'grok':
      return 'accounts-grok'
    case 'cursor':
      return 'accounts-cursor'
    case 'antigravity':
    case 'kimi':
    case 'nan':
      // Why: Orca must not mutate Kimi's CLI-owned credential lifecycle.
      // Antigravity credentials live in the agy CLI; quota is fetched directly via agy.
      // NaN's key belongs to Gentle Shell, so Orca has no settings section for it.
      return null
    case 'zcode':
      return 'accounts-zcode'
  }
}
