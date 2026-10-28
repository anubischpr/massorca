import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import {
  mobileModelPillLabel,
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
  it.each([
    { note: 'no-restricted-mode' as const, text: 'Pi chat has no restricted mode.' },
    {
      note: 'start-only-modes' as const,
      text: 'Dimmed modes can only be set when the session starts.'
    },
    {
      note: 'applies-on-next-start' as const,
      text: 'Changes apply when the session next starts.'
    }
  ])('states the $note note', ({ note, text }) => {
    expect(mobileSessionOptionNote(note)).toBe(text)
  })
})

describe('mobileModelPillLabel', () => {
  const untracked = (label: string): SessionOptionDescriptor => ({
    id: 'model',
    label,
    category: 'model',
    kind: { type: 'select', choices: [] },
    valueSource: 'unknown',
    transport: 'catalog',
    settable: true
  })

  it('names an untracked model by its own label rather than a generic one', () => {
    expect(mobileModelPillLabel(untracked("Agent's model"))).toBe("Agent's model")
  })

  it('names a tracked model by its choice label', () => {
    expect(mobileModelPillLabel(select('model', 'Model', 'gpt-6-astra'))).toBe('Model gpt-6-astra')
  })
})
