import { describe, expect, it } from 'vitest'
import { rankDelegationAgents, type DelegationRankingCandidate } from './delegation-agent-ranking'

const NOW = 1_800_000_000_000
const MINUTE = 60_000
const FRESH = NOW - MINUTE

function rank(
  candidates: readonly DelegationRankingCandidate[],
  parentAgent: string | null = null,
  staleAfterMs?: number
) {
  return rankDelegationAgents({ candidates, now: NOW, parentAgent, staleAfterMs })
}

describe('rankDelegationAgents', () => {
  it('picks the agent with the lowest binding percent', () => {
    const result = rank([
      { agent: 'claude', usage: { sessionPercent: 40, weeklyPercent: 20, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 25, weeklyPercent: 10, fetchedAt: FRESH } }
    ])
    expect(result.winner).toEqual({
      usage: {
        agent: 'codex',
        bindingPercent: 25,
        window: 'session',
        noData: false,
        excluded: null
      },
      reason: 'lowest-usage'
    })
  })

  it('binds to the tighter of the 5-hour and weekly windows', () => {
    const [entry] = rank([
      { agent: 'codex', usage: { sessionPercent: 30, weeklyPercent: 70, fetchedAt: FRESH } }
    ]).ranking
    expect(entry).toMatchObject({ bindingPercent: 70, window: 'weekly' })
  })

  it('names the 5-hour window when both windows are equal', () => {
    const [entry] = rank([
      { agent: 'codex', usage: { sessionPercent: 50, weeklyPercent: 50, fetchedAt: FRESH } }
    ]).ranking
    expect(entry).toMatchObject({ bindingPercent: 50, window: 'session' })
  })

  it.each([
    { name: 'no usage at all', usage: null },
    { name: 'no fetch time', usage: { sessionPercent: 10 } },
    {
      name: 'a sample older than 15 minutes',
      usage: { sessionPercent: 10, fetchedAt: NOW - 15 * MINUTE - 1 }
    },
    {
      name: 'a sample more than a minute ahead of the clock',
      usage: { sessionPercent: 10, fetchedAt: NOW + 2 * MINUTE }
    },
    { name: 'no window percent', usage: { fetchedAt: FRESH } }
  ])('counts $name as no data at 60%', ({ usage }) => {
    expect(rank([{ agent: 'codex', usage }]).ranking[0]).toEqual({
      agent: 'codex',
      bindingPercent: 60,
      window: null,
      noData: true,
      excluded: null
    })
  })

  it('treats a sample exactly 15 minutes old as fresh', () => {
    const [entry] = rank([
      { agent: 'codex', usage: { sessionPercent: 10, fetchedAt: NOW - 15 * MINUTE } }
    ]).ranking
    expect(entry).toMatchObject({ bindingPercent: 10, noData: false })
  })

  it('tolerates a sample a little ahead of the clock as clock skew', () => {
    const [entry] = rank([
      { agent: 'codex', usage: { sessionPercent: 10, fetchedAt: NOW + 30_000 } }
    ]).ranking
    expect(entry).toMatchObject({ bindingPercent: 10, noData: false })
  })

  it('honours a custom staleness window', () => {
    const [entry] = rank(
      [{ agent: 'codex', usage: { sessionPercent: 10, fetchedAt: NOW - 2_000 } }],
      null,
      1_000
    ).ranking
    expect(entry).toMatchObject({ bindingPercent: 60, noData: true })
  })

  it('excludes agents at 90% or above, or with a limit flag', () => {
    const result = rank([
      { agent: 'claude', usage: { sessionPercent: 90, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 10, limitReached: true, fetchedAt: FRESH } },
      { agent: 'pi', usage: { sessionPercent: 89, fetchedAt: FRESH } }
    ])
    expect(result.ranking.map(({ agent, excluded }) => [agent, excluded])).toEqual([
      ['pi', null],
      ['codex', 'limit-reached'],
      ['claude', 'usage-limit']
    ])
    expect(result.winner?.usage.agent).toBe('pi')
  })

  it('shows a limit flag without window numbers as 100% and excludes it', () => {
    expect(
      rank([{ agent: 'codex', usage: { limitReached: true, fetchedAt: FRESH } }]).ranking[0]
    ).toEqual({
      agent: 'codex',
      bindingPercent: 100,
      window: null,
      noData: false,
      excluded: 'limit-reached'
    })
  })

  it('returns no winner when every agent is excluded', () => {
    const result = rank([{ agent: 'claude', usage: { sessionPercent: 95, fetchedAt: FRESH } }])
    expect(result.winner).toBeNull()
    expect(result.ranking[0]?.excluded).toBe('usage-limit')
  })

  it('prefers the parent agent when it sits within 5 points of the best', () => {
    const result = rank(
      [
        { agent: 'claude', usage: { sessionPercent: 30, fetchedAt: FRESH } },
        { agent: 'codex', usage: { sessionPercent: 35, fetchedAt: FRESH } }
      ],
      'codex'
    )
    expect(result.winner).toMatchObject({
      usage: { agent: 'codex' },
      reason: 'parent-agent-tie'
    })
  })

  it('reports lowest-usage, not a parent tie, when the parent already has the lowest usage', () => {
    const result = rank(
      [
        { agent: 'claude', usage: { sessionPercent: 34, fetchedAt: FRESH } },
        { agent: 'codex', usage: { sessionPercent: 30, fetchedAt: FRESH } }
      ],
      'codex'
    )
    expect(result.winner).toMatchObject({ usage: { agent: 'codex' }, reason: 'lowest-usage' })
  })

  it('reports the parent tie-break when the parent loses the fixed order on an exact tie', () => {
    const result = rank(
      [
        { agent: 'codex', usage: { sessionPercent: 20, fetchedAt: FRESH } },
        { agent: 'pi', usage: { sessionPercent: 20, fetchedAt: FRESH } }
      ],
      'pi'
    )
    expect(result.winner).toMatchObject({
      usage: { agent: 'pi' },
      reason: 'parent-agent-tie'
    })
  })

  it('reports fixed-order-tie when the parent already wins the exact tie', () => {
    const result = rank(
      [
        { agent: 'codex', usage: { sessionPercent: 20, fetchedAt: FRESH } },
        { agent: 'pi', usage: { sessionPercent: 20, fetchedAt: FRESH } }
      ],
      'codex'
    )
    expect(result.winner).toMatchObject({ usage: { agent: 'codex' }, reason: 'fixed-order-tie' })
  })

  it('ignores the parent agent when it sits more than 5 points above the best', () => {
    const result = rank(
      [
        { agent: 'claude', usage: { sessionPercent: 30, fetchedAt: FRESH } },
        { agent: 'codex', usage: { sessionPercent: 36, fetchedAt: FRESH } }
      ],
      'codex'
    )
    expect(result.winner).toMatchObject({ usage: { agent: 'claude' }, reason: 'lowest-usage' })
  })

  it('breaks an exact tie by the fixed agent order', () => {
    const result = rank([
      { agent: 'pi', usage: { sessionPercent: 20, fetchedAt: FRESH } },
      { agent: 'antigravity', usage: { sessionPercent: 20, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 20, fetchedAt: FRESH } }
    ])
    expect(result.winner).toMatchObject({ usage: { agent: 'codex' }, reason: 'fixed-order-tie' })
  })

  it('orders agents outside the fixed list alphabetically after it', () => {
    const result = rank([
      { agent: 'zeta', usage: { sessionPercent: 20, fetchedAt: FRESH } },
      { agent: 'pi', usage: { sessionPercent: 20, fetchedAt: FRESH } },
      { agent: 'alpha', usage: { sessionPercent: 20, fetchedAt: FRESH } }
    ])
    expect(result.ranking.map((entry) => entry.agent)).toEqual(['pi', 'alpha', 'zeta'])
  })

  it('keeps the entry that ranks first for a duplicate agent id, in any input order', () => {
    const candidates: DelegationRankingCandidate[] = [
      { agent: 'claude', usage: { sessionPercent: 40, fetchedAt: FRESH } },
      { agent: 'claude', usage: { sessionPercent: 20, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 30, fetchedAt: FRESH } }
    ]
    const result = rank(candidates)
    expect(result.ranking.map(({ agent, bindingPercent }) => [agent, bindingPercent])).toEqual([
      ['claude', 20],
      ['codex', 30]
    ])
    expect(rank(candidates.toReversed())).toEqual(result)
  })

  it('keeps the same window for a duplicate agent id whose windows tie in percent', () => {
    const candidates: DelegationRankingCandidate[] = [
      { agent: 'codex', usage: { weeklyPercent: 50, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 50, fetchedAt: FRESH } }
    ]
    expect(rank(candidates).ranking).toEqual([
      expect.objectContaining({ agent: 'codex', bindingPercent: 50, window: 'session' })
    ])
    expect(rank(candidates.toReversed())).toEqual(rank(candidates))
  })

  it('gives the same result regardless of candidate order', () => {
    const candidates: DelegationRankingCandidate[] = [
      { agent: 'claude', usage: { sessionPercent: 30, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 34, fetchedAt: FRESH } },
      { agent: 'pi', usage: null }
    ]
    expect(rank(candidates.toReversed(), 'codex')).toEqual(rank(candidates, 'codex'))
  })
})
