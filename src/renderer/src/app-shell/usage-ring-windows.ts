import type { ProviderRateLimits, RateLimitWindow } from '../../../shared/rate-limit-types'

export type UsageRingWindows = {
  outer: RateLimitWindow
  /** Set only when the provider reports both a 5 hour and a longer window. */
  inner: RateLimitWindow | null
}

/** Outer ring is the longest window a provider reports, inner ring is its 5 hour window. */
export function getUsageRingWindows(provider: ProviderRateLimits): UsageRingWindows | null {
  const longest = provider.weekly ?? provider.monthly ?? null
  if (longest) {
    return { outer: longest, inner: provider.session }
  }
  return provider.session ? { outer: provider.session, inner: null } : null
}
