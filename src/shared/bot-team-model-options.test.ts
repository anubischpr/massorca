import { describe, expect, it } from 'vitest'
import { botModelOptions, botModelSummary } from './bot-team-model-options'

describe('botModelOptions', () => {
  it('lists models with their efforts for an agent that takes them at launch', () => {
    const options = botModelOptions('claude')
    expect(options.map((entry) => entry.id)).toContain('sonnet')
    expect(options.find((entry) => entry.id === 'sonnet')?.efforts.length).toBeGreaterThan(0)
  })

  it('offers no models for an agent that runs its own default', () => {
    expect(botModelOptions('antigravity')).toEqual([])
  })
})

describe('botModelSummary', () => {
  it('reads nothing without a model', () => {
    expect(botModelSummary({ agent: 'claude', model: null, effort: null })).toBeNull()
  })

  it('keeps a model the catalog no longer lists readable', () => {
    expect(botModelSummary({ agent: 'claude', model: 'retired', effort: 'high' })).toBe(
      'retired, high'
    )
  })
})
