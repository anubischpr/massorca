import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import {
  mobileSelectedChoiceLabel,
  mobileSessionOptionNote,
  mobileSessionOptionSheetTitle
} from './mobile-native-chat-session-option-labels'

const select = (id: string, label: string, currentValue: string): SessionOptionDescriptor => ({
  id,
  label,
  category: 'thought_level',
  kind: {
    type: 'select',
    currentValue,
    choices: [{ value: currentValue, label: `${label} ${currentValue}` }]
  },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
})

describe('mobileSessionOptionSheetTitle', () => {
  it('names the access sheet by what it controls, not its internal id', () => {
    expect(mobileSessionOptionSheetTitle(select('accessMode', 'accessMode', 'default'))).toBe(
      'Select access'
    )
  })

  it('names other sheets from their lower-cased label', () => {
    expect(mobileSessionOptionSheetTitle(select('effort', 'Effort', 'high'))).toBe('Select effort')
  })
})

describe('mobileSelectedChoiceLabel', () => {
  it('returns the label of the selected choice', () => {
    expect(mobileSelectedChoiceLabel(select('effort', 'Effort', 'high'))).toBe('Effort high')
  })

  it('returns null when the value is unknown', () => {
    const unknown = { ...select('effort', 'Effort', 'high'), valueSource: 'unknown' as const }
    expect(mobileSelectedChoiceLabel(unknown)).toBeNull()
  })
})

describe('mobileSessionOptionNote', () => {
  it('states why dimmed modes cannot be picked now', () => {
    expect(mobileSessionOptionNote('start-only-modes')).toBe(
      'Dimmed modes can only be set when the session starts.'
    )
  })
})
