import { describe, expect, it } from 'vitest'
import type { DelegationTier } from '../../shared/delegated-session-types'
import { resolveDelegationModel } from './delegation-model-tiers'

type TierRow = { tier: DelegationTier; model: string | null; effort: string }

const CLAUDE_ROWS: readonly TierRow[] = [
  { tier: 1, model: 'haiku', effort: 'high' },
  { tier: 2, model: 'haiku', effort: 'max' },
  { tier: 3, model: 'sonnet', effort: 'medium' },
  { tier: 4, model: 'sonnet', effort: 'high' },
  { tier: 5, model: 'opus', effort: 'medium' }
]

const CODEX_ROWS: readonly TierRow[] = [
  { tier: 1, model: 'gpt-6-luna', effort: 'high' },
  { tier: 2, model: 'gpt-6-luna', effort: 'max' },
  { tier: 3, model: 'gpt-6.1-sol', effort: 'medium' },
  { tier: 4, model: 'gpt-6.1-sol', effort: 'high' },
  { tier: 5, model: 'gpt-6-astra', effort: 'medium' }
]

const DEFAULT_MODEL_ROWS: readonly TierRow[] = [
  { tier: 1, model: null, effort: 'low' },
  { tier: 2, model: null, effort: 'medium' },
  { tier: 3, model: null, effort: 'medium' },
  { tier: 4, model: null, effort: 'high' },
  { tier: 5, model: null, effort: 'high' }
]

describe('resolveDelegationModel', () => {
  it.each(CLAUDE_ROWS)('maps claude tier $tier to $model at $effort', ({ tier, model, effort }) => {
    expect(resolveDelegationModel({ agent: 'claude', tier })).toEqual({
      model,
      effort,
      adjustments: []
    })
  })

  it.each(CODEX_ROWS)('maps codex tier $tier to $model at $effort', ({ tier, model, effort }) => {
    expect(resolveDelegationModel({ agent: 'codex', tier })).toEqual({
      model,
      effort,
      adjustments: []
    })
  })

  it.each(DEFAULT_MODEL_ROWS)(
    'keeps the agent default model for other agents at tier $tier',
    ({ tier, model, effort }) => {
      expect(resolveDelegationModel({ agent: 'antigravity', tier })).toEqual({
        model,
        effort,
        adjustments: []
      })
    }
  )

  it('falls back to the agent default when the catalog does not list the model', () => {
    expect(
      resolveDelegationModel({
        agent: 'codex',
        tier: 3,
        catalog: { models: ['gpt-5.5'] }
      })
    ).toEqual({ model: null, effort: 'medium', adjustments: ['model-unavailable'] })
  })

  it('keeps a listed model with no adjustments', () => {
    expect(
      resolveDelegationModel({
        agent: 'codex',
        tier: 3,
        catalog: { models: ['gpt-6.1-sol'], efforts: ['low', 'medium', 'high'] }
      })
    ).toEqual({ model: 'gpt-6.1-sol', effort: 'medium', adjustments: [] })
  })

  it('clamps an unsupported effort to the highest supported level below it', () => {
    expect(
      resolveDelegationModel({
        agent: 'claude',
        tier: 2,
        catalog: { models: ['haiku'], efforts: ['low', 'medium', 'high'] }
      })
    ).toEqual({ model: 'haiku', effort: 'high', adjustments: ['effort-clamped'] })
  })

  it('moves to the lowest supported level above when none sits below', () => {
    expect(
      resolveDelegationModel({
        agent: 'claude',
        tier: 1,
        catalog: { models: ['haiku'], efforts: ['xhigh', 'max'] }
      })
    ).toEqual({ model: 'haiku', effort: 'xhigh', adjustments: ['effort-clamped'] })
  })

  it('skips effort names the ladder does not know', () => {
    expect(
      resolveDelegationModel({
        agent: 'claude',
        tier: 2,
        catalog: { models: ['haiku'], efforts: ['turbo', 'high'] }
      })
    ).toEqual({ model: 'haiku', effort: 'high', adjustments: ['effort-clamped'] })
  })

  it('reports no effort when the model supports none', () => {
    expect(
      resolveDelegationModel({
        agent: 'claude',
        tier: 3,
        catalog: { models: ['sonnet'], efforts: [] }
      })
    ).toEqual({ model: 'sonnet', effort: null, adjustments: ['effort-clamped'] })
  })
})
