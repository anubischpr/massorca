import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits, RateLimitWindow } from '../../../../shared/rate-limit-types'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, string>) => {
    let result = fallback
    for (const [key, value] of Object.entries(values ?? {})) {
      result = result.replace(`{{${key}}}`, value)
    }
    return result
  }
}))

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null
}))

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { usagePercentageDisplay: 'used' | 'remaining' }) => unknown) =>
    selector({ usagePercentageDisplay: 'used' })
}))

const NOW = 1_700_000_000_000
const DAY_MS = 24 * 60 * 60_000

function pool(usedPercent: number, resetsAt: number | null): RateLimitWindow {
  return { usedPercent, windowMinutes: 43_200, resetsAt, resetDescription: null }
}

// The fetcher lists every metered model, most used first, and mirrors the first as `monthly`.
function nanLimits(): ProviderRateLimits {
  const busiest = pool(28, NOW + 11 * DAY_MS)
  return {
    provider: 'nan',
    session: null,
    weekly: null,
    monthly: busiest,
    buckets: [
      { ...busiest, name: 'glm5.3-flash' },
      { ...pool(14, NOW + 19 * DAY_MS), name: 'deepseek-v4-flash' }
    ],
    updatedAt: NOW,
    error: null,
    status: 'ok'
  }
}

describe('NaN usage in the status bar', () => {
  it('shows one chip with the most-used pool and its reset in verbose mode', async () => {
    const { ProviderSegment } = await import('./StatusBar')
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(NOW)

    try {
      const markup = renderToStaticMarkup(
        <ProviderSegment p={nanLimits()} compact={false} display="used" mode="verbose" />
      )

      expect(markup).toContain('28% used 11d')
      expect(markup).not.toContain('14% used')
    } finally {
      dateNow.mockRestore()
    }
  })

  it('names the most-used model in the compact chip', async () => {
    const { ProviderSegment } = await import('./StatusBar')

    const markup = renderToStaticMarkup(
      <ProviderSegment p={nanLimits()} compact={false} display="used" mode="compact" />
    )

    expect(markup).toContain('28% used glm5.3-flash')
  })

  it('lists each model once in the roster sections', async () => {
    const { getWindowSections } = await import('./tooltip')

    expect(getWindowSections(nanLimits()).map((section) => section.label)).toEqual([
      'glm5.3-flash',
      'deepseek-v4-flash',
      'Weekly'
    ])
  })
})
