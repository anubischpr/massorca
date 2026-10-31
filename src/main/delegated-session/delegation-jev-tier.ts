import type { DelegationTier } from '../../shared/delegated-session-types'
import { askJevChoice, isSafeAbstractText, type JevDecisionDeps } from '../jev/jev-decision-client'
import type { DelegationTierAdvisor } from './delegation-options'

const TIER_BY_CHOICE: Readonly<Record<string, DelegationTier>> = {
  'tier-1': 1,
  'tier-2': 2,
  'tier-3': 3,
  'tier-4': 4,
  'tier-5': 5
}

const TIER_CRITERIA = {
  'tier-1': 'Trivial exact change, easily verified, low impact: a typo, rename or version bump.',
  'tier-2': 'Ordinary default: clear bounded verifiable low-impact work.',
  'tier-3': 'Demanding work, integration, or debugging with several hypotheses; limited impact.',
  'tier-4': 'Consequential ambiguity, architecture decisions, or high error cost.',
  'tier-5': 'Exceptional systemic difficulty with high complexity or ambiguous consequences.'
} as const

const TIER_INSTRUCTIONS =
  'Choose exactly one tier for a delegated coding agent session using complexity, error impact, verifiability, and ambiguity. A higher tier runs a more capable and more expensive model, so balance cost and latency against quality and risk. Tier 5 is used rarely.'

/** Asks Jev for a task's tier; null keeps the deterministic classifier's answer. */
export function createJevDelegationTierAdvisor(deps: JevDecisionDeps): DelegationTierAdvisor {
  return async ({ summary, writes }) => {
    // Why: only the abstract one-line summary leaves the host, never the task's prompt.
    if (!isSafeAbstractText(summary)) {
      return null
    }
    const answer = await askJevChoice(
      {
        state: `Abstract delegated session task (${writes ? 'writes code' : 'read only'}): ${summary}`,
        instructions: TIER_INSTRUCTIONS,
        criteria: TIER_CRITERIA
      },
      deps
    )
    return answer ? (TIER_BY_CHOICE[answer.choice] ?? null) : null
  }
}
