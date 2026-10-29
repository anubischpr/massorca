import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROTOTYPE_COUNT_SETTING,
  buildPrototypeCountLine,
  clampPrototypeCount,
  sanitizePrototypeCountSetting
} from './prototype-count-setting'

describe('DEFAULT_PROTOTYPE_COUNT_SETTING', () => {
  it('always asks for two directions', () => {
    expect(DEFAULT_PROTOTYPE_COUNT_SETTING).toEqual({ mode: 'always', count: 2 })
  })
})

describe('clampPrototypeCount', () => {
  it('keeps counts from 1 to 4', () => {
    expect([1, 2, 3, 4].map((count) => clampPrototypeCount(count))).toEqual([1, 2, 3, 4])
  })

  it('clamps counts outside 1..4 to the nearest bound', () => {
    expect(clampPrototypeCount(0)).toBe(1)
    expect(clampPrototypeCount(-3)).toBe(1)
    expect(clampPrototypeCount(5)).toBe(4)
    expect(clampPrototypeCount(99)).toBe(4)
  })

  it('rounds fractions to the nearest integer before clamping', () => {
    expect(clampPrototypeCount(2.4)).toBe(2)
    expect(clampPrototypeCount(2.5)).toBe(3)
    expect(clampPrototypeCount(0.2)).toBe(1)
  })

  it('gives the default for NaN and infinite counts', () => {
    expect(clampPrototypeCount(Number.NaN)).toBe(2)
    expect(clampPrototypeCount(Number.POSITIVE_INFINITY)).toBe(2)
  })
})

describe('sanitizePrototypeCountSetting', () => {
  it('keeps a valid setting as it is', () => {
    expect(sanitizePrototypeCountSetting({ mode: 'ask', count: 3 })).toEqual({
      mode: 'ask',
      count: 3
    })
  })

  it('falls back to the default for input that is not a setting object', () => {
    for (const input of [undefined, null, 'ask', 4, true, ['ask', 3]]) {
      expect(sanitizePrototypeCountSetting(input)).toEqual(DEFAULT_PROTOTYPE_COUNT_SETTING)
    }
  })

  it('repairs each field on its own', () => {
    expect(sanitizePrototypeCountSetting({ mode: 'sometimes', count: 3 })).toEqual({
      mode: 'always',
      count: 3
    })
    expect(sanitizePrototypeCountSetting({ mode: 'ask', count: '3' })).toEqual({
      mode: 'ask',
      count: 2
    })
    expect(sanitizePrototypeCountSetting({ mode: 'ask', count: Number.NaN })).toEqual({
      mode: 'ask',
      count: 2
    })
    expect(sanitizePrototypeCountSetting({})).toEqual(DEFAULT_PROTOTYPE_COUNT_SETTING)
  })

  it('clamps a stored count outside 1..4', () => {
    expect(sanitizePrototypeCountSetting({ mode: 'always', count: 9 })).toEqual({
      mode: 'always',
      count: 4
    })
    expect(sanitizePrototypeCountSetting({ mode: 'always', count: 0 })).toEqual({
      mode: 'always',
      count: 1
    })
  })

  it('returns a new object, so the shared default is never handed out', () => {
    expect(sanitizePrototypeCountSetting(undefined)).not.toBe(DEFAULT_PROTOTYPE_COUNT_SETTING)
  })
})

describe('buildPrototypeCountLine', () => {
  it('asks for the given number of directions', () => {
    expect(buildPrototypeCountLine(3)).toBe(
      'Produce 3 distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'
    )
  })

  it('names the clamped count, never one outside 1..4', () => {
    expect(buildPrototypeCountLine(9)).toBe(
      'Produce 4 distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'
    )
    expect(buildPrototypeCountLine(0)).toContain('Produce 1 distinct design directions')
  })
})
