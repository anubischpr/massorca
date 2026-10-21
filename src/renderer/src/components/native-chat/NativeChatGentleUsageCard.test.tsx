// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits, RateLimitState } from '../../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'

const mocks = vi.hoisted(
  (): { rateLimits: RateLimitState | undefined; refresh: ReturnType<typeof vi.fn> } => ({
    rateLimits: undefined,
    refresh: vi.fn()
  })
)

vi.mock('@/components/status-bar/use-effective-rate-limits', () => ({
  useEffectiveRateLimits: () => ({
    rateLimits: mocks.rateLimits,
    source: 'host',
    hostLabel: null,
    refresh: mocks.refresh
  })
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: null }) => unknown) => selector({ settings: null })
}))

afterEach(() => {
  cleanup()
  mocks.refresh.mockReset()
})

const FALLBACK = '/gentle:usage opens a panel that only the Gentle Shell terminal can draw.'
const block = {
  type: 'text' as const,
  text: FALLBACK,
  tone: 'notice',
  presentation: 'gentle-shell-usage'
}

function withNan(nan: ProviderRateLimits | null | undefined): void {
  mocks.rateLimits = { ...createEmptyRateLimitState(), nan }
}

function snapshot(overrides: Partial<ProviderRateLimits> = {}): ProviderRateLimits {
  const dayMs = 24 * 60 * 60 * 1000
  return {
    provider: 'nan',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: null,
    status: 'ok',
    buckets: [
      {
        name: 'deepseek-v4-flash',
        usedPercent: 23.4,
        windowMinutes: 43200,
        resetsAt: Date.now() + 10 * dayMs + 23 * 3_600_000 + 60_000,
        resetDescription: null
      },
      { name: 'glm5.3-flash', usedPercent: 28, windowMinutes: 43200, resetsAt: null, resetDescription: null }
    ],
    ...overrides
  }
}

describe('Gentle Shell usage card', () => {
  it('draws one row per NaN model from the host snapshot', () => {
    withNan(snapshot())
    render(<NativeChatNoticeRow block={block} />)
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('nan · updated just now')).toBeInTheDocument()
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument()
    expect(screen.getByText('23% used · resets in 10d 23h')).toBeInTheDocument()
    expect(screen.getByText('28% used')).toBeInTheDocument()
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })

  it('asks the host to refresh when the person presses refresh', async () => {
    withNan(snapshot())
    mocks.refresh.mockResolvedValue(undefined)
    render(<NativeChatNoticeRow block={block} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh usage' }))
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh usage' })).toBeEnabled())
  })

  it.each([
    ['an older host without the NaN meter', undefined],
    ['no NaN key on the host', null],
    ['a snapshot without models', snapshot({ buckets: [], status: 'unavailable' })]
  ])('shows the terminal-only notice for %s', (_name, nan) => {
    withNan(nan)
    render(<NativeChatNoticeRow block={block} />)
    expect(screen.getByText(FALLBACK)).toBeInTheDocument()
    expect(screen.queryByText('Subscriptions')).toBeNull()
  })
})
