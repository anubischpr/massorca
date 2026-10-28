import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { ProviderRateLimits, RateLimitState } from '../../shared/rate-limit-types'
import type { DelegationRankingCandidate, DelegationUsageSample } from './delegation-agent-ranking'

export type DelegationUsageAgent = {
  agent: string
  /** Only Gentle Shell, the `pi` agent on its NaN runtime, has a usage meter. */
  piRuntime?: PiRuntimeSelection
}

type MeteredProvider = 'claude' | 'codex' | 'antigravity' | 'nan'

function meteredProviderFor({ agent, piRuntime }: DelegationUsageAgent): MeteredProvider | null {
  switch (agent) {
    case 'claude':
      return 'claude'
    case 'codex':
      return 'codex'
    case 'antigravity':
      return 'antigravity'
    case 'pi':
      return piRuntime === 'gentle-shell' ? 'nan' : null
    default:
      return null
  }
}

function usageSampleFrom(rateLimits: ProviderRateLimits): DelegationUsageSample {
  const windows = [rateLimits.session, rateLimits.weekly]
  return {
    sessionPercent: rateLimits.session?.usedPercent,
    weeklyPercent: rateLimits.weekly?.usedPercent,
    // Why: a window at 100% is exhausted even when the provider sets no limit flag.
    limitReached: windows.some((entry) => (entry?.usedPercent ?? 0) >= 100),
    fetchedAt: rateLimits.updatedAt
  }
}

// Why: top-level provider entries are the active account; inactive accounts are not routed to in v1.
export function delegationUsageCandidates(
  state: RateLimitState,
  agents: readonly DelegationUsageAgent[]
): DelegationRankingCandidate[] {
  return agents.map((usageAgent) => {
    const provider = meteredProviderFor(usageAgent)
    const rateLimits = provider === null ? null : (state[provider] ?? null)
    return {
      agent: usageAgent.agent,
      usage: rateLimits === null ? null : usageSampleFrom(rateLimits)
    }
  })
}
