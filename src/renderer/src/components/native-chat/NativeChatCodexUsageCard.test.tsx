// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { NativeChatCodexUsageCard } from './NativeChatCodexUsageCard'

const state = vi.hoisted((): { codex: ProviderRateLimits | null } => ({ codex: null }))

vi.mock('@/store', () => ({
  useAppStore: (select: (value: { settings: null }) => unknown) => select({ settings: null })
}))
vi.mock('@/components/status-bar/use-effective-rate-limits', () => ({
  useEffectiveRateLimits: () => ({
    rateLimits: { codex: state.codex },
    refresh: async () => undefined
  })
}))

afterEach(cleanup)

function codex(overrides: Partial<ProviderRateLimits>): ProviderRateLimits {
  return {
    provider: 'codex',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: null,
    status: 'ok',
    ...overrides
  }
}

describe('NativeChatCodexUsageCard', () => {
  it('draws one bar per Codex window from the account snapshot', () => {
    state.codex = codex({
      session: { usedPercent: 37, windowMinutes: 300, resetsAt: null, resetDescription: null },
      weekly: { usedPercent: 80, windowMinutes: 10080, resetsAt: null, resetDescription: null }
    })
    render(<NativeChatCodexUsageCard fallback={<p>fallback</p>} />)
    expect(screen.getByText('Codex usage')).toBeInTheDocument()
    expect(screen.getByText('37% used')).toBeInTheDocument()
    expect(screen.getByText('80% used')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).toBeNull()
  })

  it('keeps the row text when the snapshot has no Codex windows', () => {
    state.codex = null
    render(<NativeChatCodexUsageCard fallback={<p>fallback</p>} />)
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })
})
