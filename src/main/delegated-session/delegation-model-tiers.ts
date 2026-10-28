import type { DelegationTier } from '../../shared/delegated-session-types'

export type DelegationModelCatalog = {
  /** Model ids the agent can run now; a table model missing here falls back to the agent default. */
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

type TierChoice = { model: string | null; effort: string }

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

// Other agents keep their own default model and only get an effort level.
const AGENT_DEFAULT_TIERS: Readonly<Record<DelegationTier, TierChoice>> = {
  1: { model: null, effort: 'low' },
  2: { model: null, effort: 'medium' },
  3: { model: null, effort: 'medium' },
  4: { model: null, effort: 'high' },
  5: { model: null, effort: 'high' }
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

function tierTableFor(agent: string): Readonly<Record<DelegationTier, TierChoice>> {
  switch (agent) {
    case 'claude':
      return CLAUDE_TIERS
    case 'codex':
      return CODEX_TIERS
    default:
      return AGENT_DEFAULT_TIERS
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
  const wanted = tierTableFor(agent)[tier]
  const adjustments: DelegationModelAdjustment[] = []
  let model = wanted.model
  if (model !== null && catalog !== undefined && !catalog.models.includes(model)) {
    model = null
    adjustments.push('model-unavailable')
  }
  let effort: string | null = wanted.effort
  const supportedEfforts = catalog?.efforts
  if (supportedEfforts !== undefined) {
    effort = clampEffort(wanted.effort, supportedEfforts)
    if (effort !== wanted.effort) {
      adjustments.push('effort-clamped')
    }
  }
  return { model, effort, adjustments }
}
