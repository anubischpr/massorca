import { describe, expect, it } from 'vitest'
import { isModelPillIconOnly } from './mobile-native-chat-model-pill-width'

describe('isModelPillIconOnly', () => {
  it('hides the model name on narrow screens when the agent icon can stand in', () => {
    expect(isModelPillIconOnly(320, true)).toBe(true)
    expect(isModelPillIconOnly(359, true)).toBe(true)
  })

  it('keeps the model name from 360pt up', () => {
    expect(isModelPillIconOnly(360, true)).toBe(false)
    expect(isModelPillIconOnly(390, true)).toBe(false)
  })

  it('never leaves an empty pill when no agent icon is known', () => {
    expect(isModelPillIconOnly(320, false)).toBe(false)
  })
})
