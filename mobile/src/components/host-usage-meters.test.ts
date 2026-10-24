import { describe, expect, it } from 'vitest'

import { decodeAccountsSnapshot } from './accounts-snapshot'
import { getHostUsageMeters, readHostUsageMeterLimits } from './host-usage-meters'

const window = (usedPercent: number, windowMinutes: number) => ({
  usedPercent,
  windowMinutes,
  resetsAt: null,
  resetDescription: null
})

function hostSnapshot(extraRateLimits: Record<string, unknown>) {
  return decodeAccountsSnapshot({
    claude: { accounts: [], activeAccountId: null },
    codex: { accounts: [], activeAccountId: null },
    rateLimits: {
      claude: null,
      codex: null,
      inactiveClaudeAccounts: [],
      inactiveCodexAccounts: [],
      ...extraRateLimits
    }
  })
}

const antigravity = {
  provider: 'antigravity',
  session: window(20, 300),
  weekly: window(55, 10_080),
  buckets: [{ ...window(55, 10_080), name: 'Gemini Models' }],
  updatedAt: 1,
  error: null,
  status: 'ok'
}

const nan = {
  provider: 'nan',
  session: null,
  weekly: null,
  monthly: window(70, 43_200),
  buckets: [{ ...window(70, 43_200), name: 'model-a' }],
  updatedAt: 1,
  error: null,
  status: 'ok'
}

describe('getHostUsageMeters', () => {
  it('lists the Antigravity and NaN meters a host publishes, with the windows each reports', () => {
    const meters = getHostUsageMeters(hostSnapshot({ antigravity, nan }))

    expect(meters.map((meter) => [meter.key, meter.label, meter.iconAgentId])).toEqual([
      ['antigravity', 'Antigravity', 'antigravity'],
      ['nan', 'NaN Builders', 'pi']
    ])
    expect(meters[0].windows.map((w) => w.label)).toEqual(['5h', '7d'])
    expect(meters[1].windows.map((w) => w.label)).toEqual(['30d'])
    expect(meters[1].limits.monthly?.usedPercent).toBe(70)
  })

  it('shows nothing for an older host that does not publish these meters', () => {
    expect(getHostUsageMeters(hostSnapshot({}))).toEqual([])
  })

  it('hides a meter whose host has no credentials for it', () => {
    const meters = getHostUsageMeters(
      hostSnapshot({
        antigravity: {
          ...antigravity,
          session: null,
          weekly: null,
          buckets: [],
          status: 'unavailable'
        }
      })
    )
    expect(meters).toEqual([])
  })

  it('keeps one placeholder bar for a meter that answered ok before reporting a window', () => {
    const meters = getHostUsageMeters(hostSnapshot({ nan: { ...nan, monthly: null, buckets: [] } }))
    expect(meters.map((meter) => meter.windows.map((w) => w.key))).toEqual([['session']])
  })

  it('drops a malformed or misattributed meter without failing the snapshot', () => {
    const snapshot = hostSnapshot({
      antigravity: { ...antigravity, provider: 'nan' },
      nan: { provider: 'nan', status: 'surprising' }
    })
    expect(readHostUsageMeterLimits(snapshot, 'antigravity')).toBeNull()
    expect(readHostUsageMeterLimits(snapshot, 'nan')).toBeNull()
    expect(getHostUsageMeters(snapshot)).toEqual([])
  })
})
