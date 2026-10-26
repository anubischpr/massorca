import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import { effortMeterLevel } from './mobile-native-chat-effort-meter'

const effort = (
  choiceCount: number,
  selectedIndex: number | undefined
): SessionOptionDescriptor => ({
  id: 'effort',
  label: 'Effort',
  category: 'thought_level',
  kind: {
    type: 'select',
    ...(selectedIndex === undefined ? {} : { currentValue: `level-${selectedIndex}` }),
    choices: Array.from({ length: choiceCount }, (_, index) => ({
      value: `level-${index}`,
      label: `Level ${index}`
    }))
  },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
})

describe('effortMeterLevel', () => {
  it.each([
    { choiceCount: 3, levels: [2, 3, 5] },
    { choiceCount: 5, levels: [1, 2, 3, 4, 5] },
    { choiceCount: 7, levels: [1, 1, 2, 3, 4, 4, 5] }
  ])('maps $choiceCount choices onto the five bars', ({ choiceCount, levels }) => {
    levels.forEach((level, index) => {
      expect(effortMeterLevel(effort(choiceCount, index))).toBe(level)
    })
  })

  it('lights no bars when nothing is selected', () => {
    expect(effortMeterLevel(effort(5, undefined))).toBe(0)
  })

  it('lights no bars for a descriptor that is not a select', () => {
    const boolean: SessionOptionDescriptor = {
      id: 'effort',
      label: 'Effort',
      category: 'thought_level',
      kind: { type: 'boolean', currentValue: true },
      valueSource: 'reported',
      transport: 'catalog',
      settable: true
    }
    expect(effortMeterLevel(boolean)).toBe(0)
  })
})
