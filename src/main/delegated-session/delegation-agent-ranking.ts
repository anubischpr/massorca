import type {
  DelegationAgentUsage,
  DelegationExclusion,
  DelegationReasonCode,
  DelegationUsageWindow
} from '../../shared/delegated-session-types'

/** Usage the router reads for one agent; a missing window is unknown, not zero. */
export type DelegationUsageSample = {
  /** Used percent of the 5-hour window. */
  sessionPercent?: number
  /** Used percent of the 7-day window. */
  weeklyPercent?: number
  /** Used percent of the 30-day allowance; binds only when no 5-hour or weekly window is known. */
  monthlyPercent?: number
  limitReached?: boolean
  /** Unix ms of the sample; without it the sample cannot count as fresh. */
  fetchedAt?: number
}

export type DelegationRankingCandidate = {
  agent: string
  usage: DelegationUsageSample | null
}

export type DelegationRankingInput = {
  candidates: readonly DelegationRankingCandidate[]
  /** Unix ms; the clock the freshness check reads. */
  now: number
  parentAgent: string | null
  staleAfterMs?: number
}

export type DelegationWinner = {
  usage: DelegationAgentUsage
  reason: Extract<DelegationReasonCode, 'lowest-usage' | 'parent-agent-tie' | 'fixed-order-tie'>
}

export type DelegationRanking = {
  /** Eligible agents first, then excluded ones; each group by binding percent, then fixed order. */
  ranking: DelegationAgentUsage[]
  winner: DelegationWinner | null
}

type BindingWindow = { percent: number; window: DelegationUsageWindow | 'monthly' }

const NO_DATA_BINDING_PERCENT = 60
const USAGE_LIMIT_PERCENT = 90
const TIE_TOLERANCE_POINTS = 5
const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000
// Why: a sample a little ahead of this clock is clock skew; further ahead it cannot be a real reading.
const FUTURE_SAMPLE_TOLERANCE_MS = 60 * 1000
// Why: a fixed order breaks ties, so the same inputs always pick the same agent.
const FIXED_AGENT_ORDER: readonly string[] = ['claude', 'codex', 'antigravity', 'pi']

function finitePercent(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined
}

// Why: the tighter window binds; on a tie the 5-hour window is named.
function bindingWindowOf(usage: DelegationUsageSample): BindingWindow | null {
  const session = finitePercent(usage.sessionPercent)
  const weekly = finitePercent(usage.weeklyPercent)
  if (session !== undefined && (weekly === undefined || session >= weekly)) {
    return { percent: session, window: 'session' }
  }
  if (weekly !== undefined) {
    return { percent: weekly, window: 'weekly' }
  }
  // Why: a monthly allowance binds only when no 5-hour or weekly window is known.
  const monthly = finitePercent(usage.monthlyPercent)
  return monthly === undefined ? null : { percent: monthly, window: 'monthly' }
}

function noDataUsage(agent: string): DelegationAgentUsage {
  return {
    agent,
    bindingPercent: NO_DATA_BINDING_PERCENT,
    window: null,
    noData: true,
    excluded: null
  }
}

function exclusionFor(percent: number, limitReached: boolean): DelegationExclusion | null {
  if (limitReached) {
    return 'limit-reached'
  }
  return percent >= USAGE_LIMIT_PERCENT ? 'usage-limit' : null
}

function isStale(fetchedAt: number, now: number, staleAfterMs: number): boolean {
  const age = now - fetchedAt
  return age > staleAfterMs || age < -FUTURE_SAMPLE_TOLERANCE_MS
}

function usageEntryFor(
  { agent, usage }: DelegationRankingCandidate,
  now: number,
  staleAfterMs: number
): DelegationAgentUsage {
  if (
    usage === null ||
    usage.fetchedAt === undefined ||
    isStale(usage.fetchedAt, now, staleAfterMs)
  ) {
    return noDataUsage(agent)
  }
  const limitReached = usage.limitReached === true
  const binding = bindingWindowOf(usage)
  if (binding === null) {
    // Why: a limit flag without a window percent is still a limit, shown as full.
    return limitReached
      ? { agent, bindingPercent: 100, window: null, noData: false, excluded: 'limit-reached' }
      : noDataUsage(agent)
  }
  const entry: DelegationAgentUsage = {
    agent,
    bindingPercent: binding.percent,
    window: binding.window === 'monthly' ? null : binding.window,
    noData: false,
    excluded: exclusionFor(binding.percent, limitReached)
  }
  return binding.window === 'monthly' ? { ...entry, monthly: true } : entry
}

function fixedRank(agent: string): number {
  const index = FIXED_AGENT_ORDER.indexOf(agent)
  return index === -1 ? FIXED_AGENT_ORDER.length : index
}

// Why: code-unit order, so the tie-break never depends on the host locale.
function compareText(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  return a < b ? -1 : 1
}

// Why: a total order over every field the router reads, so duplicate ids always sort the same way.
function compareRanking(a: DelegationAgentUsage, b: DelegationAgentUsage): number {
  return (
    Number(a.excluded !== null) - Number(b.excluded !== null) ||
    a.bindingPercent - b.bindingPercent ||
    fixedRank(a.agent) - fixedRank(b.agent) ||
    compareText(a.agent, b.agent) ||
    Number(a.noData) - Number(b.noData) ||
    compareText(a.window ?? '', b.window ?? '') ||
    Number(a.monthly === true) - Number(b.monthly === true) ||
    compareText(a.excluded ?? '', b.excluded ?? '')
  )
}

// Why: a duplicate id keeps the entry that ranks first, so input order never decides.
function keepFirstPerAgent(sorted: readonly DelegationAgentUsage[]): DelegationAgentUsage[] {
  const seen = new Set<string>()
  return sorted.filter((entry) => {
    if (seen.has(entry.agent)) {
      return false
    }
    seen.add(entry.agent)
    return true
  })
}

function winnerFrom(
  eligible: readonly DelegationAgentUsage[],
  parentAgent: string | null
): DelegationWinner | null {
  const best = eligible.at(0)
  if (best === undefined) {
    return null
  }
  const contenders = eligible.filter(
    (entry) => entry.bindingPercent <= best.bindingPercent + TIE_TOLERANCE_POINTS
  )
  if (contenders.length === 1) {
    return { usage: best, reason: 'lowest-usage' }
  }
  // Why: the tie-break changes the pick only when the parent does not already rank first.
  const parent = contenders.find((entry) => entry.agent === parentAgent)
  if (parent !== undefined && parent.agent !== best.agent) {
    return { usage: parent, reason: 'parent-agent-tie' }
  }
  const exactTie = contenders.at(1)?.bindingPercent === best.bindingPercent
  return { usage: best, reason: exactTie ? 'fixed-order-tie' : 'lowest-usage' }
}

export function rankDelegationAgents(input: DelegationRankingInput): DelegationRanking {
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  const ranking = keepFirstPerAgent(
    input.candidates
      .map((candidate) => usageEntryFor(candidate, input.now, staleAfterMs))
      .sort(compareRanking)
  )
  const eligible = ranking.filter((entry) => entry.excluded === null)
  return { ranking, winner: winnerFrom(eligible, input.parentAgent) }
}
