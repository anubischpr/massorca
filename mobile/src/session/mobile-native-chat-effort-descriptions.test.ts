import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import {
  mobileEffortDescription,
  mobileEffortDescriptorWithDescriptions
} from './mobile-native-chat-effort-descriptions'

const effort: SessionOptionDescriptor = {
  id: 'effort',
  label: 'Effort',
  category: 'thought_level',
  kind: {
    type: 'select',
    currentValue: 'high',
    choices: [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High', disabled: true },
      { value: 'turbo', label: 'Turbo' }
    ]
  },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
}

describe('mobileEffortDescription', () => {
  it.each([
    ['minimal', 'Fastest replies, almost no thinking'],
    ['low', 'Quick replies, minimal thinking'],
    ['medium', 'Balanced thinking'],
    ['high', 'Thinks longer before answering'],
    ['xhigh', 'For hard, multi-step problems'],
    ['max', 'Deepest reasoning, slowest'],
    ['ultra', 'Maximum reasoning budget']
  ])('describes %s', (value, description) => {
    expect(mobileEffortDescription(value)).toBe(description)
  })

  it('has no description for a level it does not know', () => {
    expect(mobileEffortDescription('turbo')).toBeNull()
  })
})

describe('mobileEffortDescriptorWithDescriptions', () => {
  it('adds each known level its description and keeps the rest of every choice', () => {
    expect(mobileEffortDescriptorWithDescriptions(effort).kind).toEqual({
      type: 'select',
      currentValue: 'high',
      choices: [
        { value: 'low', label: 'Low', description: 'Quick replies, minimal thinking' },
        {
          value: 'high',
          label: 'High',
          description: 'Thinks longer before answering',
          disabled: true
        },
        { value: 'turbo', label: 'Turbo' }
      ]
    })
  })

  it('leaves a non-select descriptor as it was', () => {
    const boolean: SessionOptionDescriptor = {
      ...effort,
      kind: { type: 'boolean', currentValue: true }
    }
    expect(mobileEffortDescriptorWithDescriptions(boolean)).toBe(boolean)
  })
})
