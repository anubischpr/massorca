import { describe, expect, it } from 'vitest'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import type { ProviderRateLimits, RateLimitWindow } from '../../shared/rate-limit-types'
import { rankDelegationAgents } from './delegation-agent-ranking'
import { delegationUsageCandidates } from './delegation-usage-input'

const NOW = 1_800_000_000_000
const MINUTE = 60_000

function window(usedPercent: number): RateLimitWindow {
  return { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: null }
}

function monthly(usedPercent: number): RateLimitWindow {
  return { usedPercent, windowMinutes: 30 * 24 * 60, resetsAt: null, resetDescription: null }
}

function provider(
  name: ProviderRateLimits['provider'],
  overrides: Partial<ProviderRateLimits> = {}
): ProviderRateLimits {
  return {
    provider: name,
    session: null,
    weekly: null,
    updatedAt: NOW - MINUTE,
    error: null,
    status: 'ok',
    ...overrides
  }
}

describe('delegationUsageCandidates', () => {
  it('maps the active claude account to the router sample', () => {
    const state = createEmptyRateLimitState({
      claude: provider('claude', { session: window(42), weekly: window(17) })
    })
    expect(delegationUsageCandidates(state, [{ agent: 'claude' }])).toEqual([
      {
        agent: 'claude',
        usage: {
          sessionPercent: 42,
          weeklyPercent: 17,
          limitReached: false,
          fetchedAt: NOW - MINUTE
        }
      }
    ])
  })

  it('maps codex and antigravity to their own meters, leaving a missing window unknown', () => {
    const state = createEmptyRateLimitState({
      codex: provider('codex', { session: window(8) }),
      antigravity: provider('antigravity', { weekly: window(63) })
    })
    const candidates = delegationUsageCandidates(state, [
      { agent: 'codex' },
      { agent: 'antigravity' }
    ])
    expect(candidates).toEqual([
      {
        agent: 'codex',
        usage: { sessionPercent: 8, limitReached: false, fetchedAt: NOW - MINUTE }
      },
      {
        agent: 'antigravity',
        usage: { weeklyPercent: 63, limitReached: false, fetchedAt: NOW - MINUTE }
      }
    ])
    expect(candidates[0]?.usage?.weeklyPercent).toBeUndefined()
  })

  it('reads Gentle Shell from the NaN meter and gives stock Pi no meter', () => {
    const state = createEmptyRateLimitState({ nan: provider('nan', { session: window(55) }) })
    expect(
      delegationUsageCandidates(state, [{ agent: 'pi', piRuntime: 'gentle-shell' }])[0]?.usage
    ).toMatchObject({ sessionPercent: 55 })
    expect(
      delegationUsageCandidates(state, [{ agent: 'pi', piRuntime: 'pi' }, { agent: 'pi' }]).map(
        (candidate) => candidate.usage
      )
    ).toEqual([null, null])
  })

  it('reads a NaN meter that reports only a monthly allowance, and the router ranks it on that', () => {
    const state = createEmptyRateLimitState({ nan: provider('nan', { monthly: monthly(42) }) })
    const candidates = delegationUsageCandidates(state, [
      { agent: 'pi', piRuntime: 'gentle-shell' }
    ])
    expect(candidates).toEqual([
      { agent: 'pi', usage: { monthlyPercent: 42, limitReached: false, fetchedAt: NOW - MINUTE } }
    ])
    expect(rankDelegationAgents({ candidates, now: NOW, parentAgent: null }).ranking).toEqual([
      {
        agent: 'pi',
        bindingPercent: 42,
        window: null,
        monthly: true,
        noData: false,
        excluded: null
      }
    ])
  })

  it('keeps a 5-hour or weekly window binding over a monthly allowance reported alongside it', () => {
    const state = createEmptyRateLimitState({
      nan: provider('nan', { weekly: window(30), monthly: monthly(80) })
    })
    const candidates = delegationUsageCandidates(state, [
      { agent: 'pi', piRuntime: 'gentle-shell' }
    ])
    expect(candidates[0]?.usage?.monthlyPercent).toBeUndefined()
    expect(rankDelegationAgents({ candidates, now: NOW, parentAgent: null }).ranking).toEqual([
      { agent: 'pi', bindingPercent: 30, window: 'weekly', noData: false, excluded: null }
    ])
  })

  it('flags a monthly allowance at 100% as a limit, as it flags a window', () => {
    const state = createEmptyRateLimitState({ nan: provider('nan', { monthly: monthly(100) }) })
    expect(
      delegationUsageCandidates(state, [{ agent: 'pi', piRuntime: 'gentle-shell' }])[0]?.usage
    ).toMatchObject({ monthlyPercent: 100, limitReached: true })
  })

  it('gives agents without a mapped meter no usage, even when a same-named meter has data', () => {
    const state = createEmptyRateLimitState({
      grok: provider('grok', { session: window(10) })
    })
    const usages = delegationUsageCandidates(state, [
      { agent: 'grok' },
      { agent: 'omp' },
      { agent: 'opencode' }
    ]).map((candidate) => candidate.usage)
    expect(usages).toEqual([null, null, null])
  })

  it('gives no usage for a meter the snapshot has not fetched yet', () => {
    expect(delegationUsageCandidates(createEmptyRateLimitState(), [{ agent: 'claude' }])).toEqual([
      { agent: 'claude', usage: null }
    ])
  })

  it.each(['error', 'unavailable'] as const)(
    'gives no usage for a meter whose status is %s, even with old numbers',
    (status) => {
      const state = createEmptyRateLimitState({
        codex: provider('codex', { session: window(5), status, error: null })
      })
      expect(delegationUsageCandidates(state, [{ agent: 'codex' }])).toEqual([
        { agent: 'codex', usage: null }
      ])
    }
  )

  it('flags a window at 100% as a limit', () => {
    const state = createEmptyRateLimitState({
      codex: provider('codex', { session: window(20), weekly: window(100) })
    })
    expect(delegationUsageCandidates(state, [{ agent: 'codex' }])[0]?.usage).toMatchObject({
      weeklyPercent: 100,
      limitReached: true
    })
  })

  it('lets the router treat a stale meter as no data', () => {
    const state = createEmptyRateLimitState({
      codex: provider('codex', { session: window(5), updatedAt: NOW - 16 * MINUTE })
    })
    const { ranking } = rankDelegationAgents({
      candidates: delegationUsageCandidates(state, [{ agent: 'codex' }]),
      now: NOW,
      parentAgent: null
    })
    expect(ranking[0]).toMatchObject({ agent: 'codex', bindingPercent: 60, noData: true })
  })
})
