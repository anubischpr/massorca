import { describe, expect, it } from 'vitest'
import {
  antigravityLaunchOptionProblem,
  antigravityLiveOptions,
  antigravityOptionsInForce,
  isAntigravityLaunchOptionKey
} from './antigravity-session-options'

describe('Antigravity launch options', () => {
  it('accepts only the keys agy takes at launch', () => {
    expect(isAntigravityLaunchOptionKey('model')).toBe(true)
    expect(isAntigravityLaunchOptionKey('effort')).toBe(true)
    expect(isAntigravityLaunchOptionKey('accessMode')).toBe(false)
  })

  it('refuses an empty model and an effort outside low, medium and high', () => {
    expect(antigravityLaunchOptionProblem('model', '')).toMatch(/must not be empty/)
    expect(antigravityLaunchOptionProblem('effort', 'maximum')).toMatch(/low, medium, or high/)
    expect(antigravityLaunchOptionProblem('effort', 'high')).toBeNull()
  })

  it('reports the launch values with each pick applied, and no other launch selection', () => {
    const launch = { model: 'a', effort: 'low', accessMode: 'full-access' }
    expect(antigravityOptionsInForce(launch, new Map([['model', 'b']]))).toEqual({
      model: 'b',
      effort: 'low'
    })
    expect(antigravityOptionsInForce(undefined, new Map())).toEqual({})
  })

  it('shows a live child its launch values, with the picks as current until it starts again', () => {
    expect(antigravityLiveOptions({ model: 'a' }, new Map([['effort', 'high']]))).toEqual({
      models: [],
      current: { model: 'a', effort: 'high' }
    })
    expect(antigravityLiveOptions(undefined, new Map())).toEqual({ models: [], current: {} })
  })
})
