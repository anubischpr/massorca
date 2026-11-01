import { describe, expect, it } from 'vitest'
import type { ProviderRateLimits, RateLimitWindow } from '../../../shared/rate-limit-types'
import { getUsageRingWindows } from './usage-ring-windows'

const windowOf = (usedPercent: number): RateLimitWindow => ({
  usedPercent,
  windowMinutes: 300,
  resetsAt: null,
  resetDescription: null
})

function provider(windows: Partial<ProviderRateLimits>): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status: 'ok',
    ...windows
  }
}

describe('getUsageRingWindows', () => {
  it('draws a double ring, weekly outside and 5 hours inside, when both exist', () => {
    const session = windowOf(38)
    const weekly = windowOf(62)
    expect(getUsageRingWindows(provider({ session, weekly }))).toEqual({
      outer: weekly,
      inner: session
    })
  })

  it('draws one ring when a provider only reports weekly usage', () => {
    const weekly = windowOf(45)
    expect(getUsageRingWindows(provider({ weekly }))).toEqual({ outer: weekly, inner: null })
  })

  it('falls back to the monthly or 5 hour window, and to nothing without data', () => {
    const monthly = windowOf(10)
    const session = windowOf(20)
    expect(getUsageRingWindows(provider({ monthly }))?.outer).toBe(monthly)
    expect(getUsageRingWindows(provider({ session }))).toEqual({ outer: session, inner: null })
    expect(getUsageRingWindows(provider({}))).toBeNull()
  })
})
