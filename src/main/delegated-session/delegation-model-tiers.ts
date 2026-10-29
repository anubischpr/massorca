import type { DelegationTier } from '../../shared/delegated-session-types'

export type DelegationModelCatalog = {
  /** Model ids the agent can run now; a table model missing here falls back to the agent default with no effort. */
  models: readonly string[]
  /** Effort levels the chosen model supports; omitted keeps the table effort as written. */
  efforts?: readonly string[]
}

export type DelegationModelAdjustment = 'model-unavailable' | 'effort-clamped'

export type DelegationModelResolution = {
  model: string | null
  effort: string | null
  adjustments: DelegationModelAdjustment[]
}

type TierChoice = { model: string; effort: string }

// Why: aliases are the ids the Claude option catalog offers; opus stays at medium to bound cost.
const CLAUDE_TIERS: Readonly<Record<DelegationTier, TierChoice>> = {
  1: { model: 'haiku', effort: 'high' },
  2: { model: 'haiku', effort: 'max' },
  3: { model: 'sonnet', effort: 'medium' },
  4: { model: 'sonnet', effort: 'high' },
  5: { model: 'opus', effort: 'medium' }
}

// Why: GPT-6.1 Sol plus GPT-6 Astra and Luna are the Codex models the mobile model sheet features.
const CODEX_TIERS: Readonly<Record<DelegationTier, TierChoice>> = {
  1: { model: 'gpt-6-luna', effort: 'high' },
  2: { model: 'gpt-6-luna', effort: 'max' },
  3: { model: 'gpt-6.1-sol', effort: 'medium' },
  4: { model: 'gpt-6.1-sol', effort: 'high' },
  5: { model: 'gpt-6-astra', effort: 'medium' }
}

// Why: a clamp moves to the nearest supported level on this ladder, at or below first.
const EFFORT_LADDER: readonly string[] = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra'
]

// Why: other agents run their own default model; worker-start refuses an effort without a model.
function tierChoiceFor(agent: string, tier: DelegationTier): TierChoice | null {
  switch (agent) {
    case 'claude':
      return CLAUDE_TIERS[tier]
    case 'codex':
      return CODEX_TIERS[tier]
    default:
      return null
  }
}

function clampEffort(wanted: string, supported: readonly string[]): string | null {
  if (supported.includes(wanted)) {
    return wanted
  }
  const wantedRank = EFFORT_LADDER.indexOf(wanted)
  const ranked = supported
    .map((effort) => ({ effort, rank: EFFORT_LADDER.indexOf(effort) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank)
  const atOrBelow = ranked.filter((entry) => entry.rank <= wantedRank)
  return (atOrBelow.at(-1) ?? ranked.at(0))?.effort ?? null
}

export function resolveDelegationModel({
  agent,
  tier,
  catalog
}: {
  agent: string
  tier: DelegationTier
  catalog?: DelegationModelCatalog
}): DelegationModelResolution {
  const wanted = tierChoiceFor(agent, tier)
  if (wanted === null) {
    return { model: null, effort: null, adjustments: [] }
  }
  if (catalog !== undefined && !catalog.models.includes(wanted.model)) {
    // Why: the catalog's efforts belong to its listed models, so a dropped model keeps no effort.
    return { model: null, effort: null, adjustments: ['model-unavailable'] }
  }
  const adjustments: DelegationModelAdjustment[] = []
  let effort: string | null = wanted.effort
  if (catalog?.efforts !== undefined) {
    effort = clampEffort(wanted.effort, catalog.efforts)
    if (effort !== wanted.effort) {
      adjustments.push('effort-clamped')
    }
  }
  return { model: wanted.model, effort, adjustments }
}
