import { describe, expect, it, vi } from 'vitest'
import { waitForDelegationUsageRefresh } from './delegation-usage-refresh'

describe('waitForDelegationUsageRefresh', () => {
  it('returns once the refresh finishes', async () => {
    const refresh = vi.fn(async () => {})
    await waitForDelegationUsageRefresh(refresh, 60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops waiting for a refresh that never finishes', async () => {
    await expect(
      waitForDelegationUsageRefresh(() => new Promise<void>(() => {}), 1)
    ).resolves.toBeUndefined()
  })

  it('does not fail the request when the refresh fails', async () => {
    await expect(
      waitForDelegationUsageRefresh(() => Promise.reject(new Error('offline')), 60_000)
    ).resolves.toBeUndefined()
  })
})
