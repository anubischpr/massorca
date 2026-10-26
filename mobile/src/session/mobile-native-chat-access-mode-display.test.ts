import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import {
  mobileAccessChoiceLabel,
  mobileAccessCurrentValue,
  mobileAccessDescriptorWithLabels,
  mobileAccessDisplay
} from './mobile-native-chat-access-mode-display'

const accessDescriptor = (
  currentValue: string | undefined,
  inheritedAccess?: SessionOptionDescriptor['inheritedAccess']
): SessionOptionDescriptor => ({
  id: 'accessMode',
  label: 'accessMode',
  category: 'mode',
  kind: {
    type: 'select',
    ...(currentValue === undefined ? {} : { currentValue }),
    choices: [
      { value: 'inherit', label: 'inherit' },
      { value: 'default', label: 'default' },
      { value: 'full-access', label: 'full-access' }
    ]
  },
  valueSource: 'reported',
  transport: 'agent-session',
  settable: true,
  ...(inheritedAccess ? { inheritedAccess } : {})
})

describe('mobileAccessChoiceLabel', () => {
  it.each([
    ['inherit', 'Inherit global setting'],
    ['default', 'Ask for approval'],
    ['auto', 'Auto'],
    ['accept-edits', 'Accept edits'],
    ['plan', 'Plan'],
    ['read-only', 'Read only'],
    ['full-access', 'Full access']
  ])('labels %s as %s', (value, label) => {
    expect(mobileAccessChoiceLabel(value)).toBe(label)
  })

  it('has no human label for a value it does not know', () => {
    expect(mobileAccessChoiceLabel('something-new')).toBeNull()
  })
})

describe('mobileAccessDisplay', () => {
  it.each([
    { value: 'default', icon: 'Lock', tone: 'neutral' },
    { value: 'accept-edits', icon: 'LockKeyhole', tone: 'neutral' },
    { value: 'plan', icon: 'NotebookPen', tone: 'neutral' },
    { value: 'read-only', icon: 'Eye', tone: 'neutral' },
    { value: 'auto', icon: 'LockOpen', tone: 'caution' },
    { value: 'full-access', icon: 'LockOpen', tone: 'danger' }
  ])('draws $value as $icon in the $tone tone', ({ value, icon, tone }) => {
    expect(mobileAccessDisplay(value, undefined)).toEqual({ icon, tone })
  })

  it.each([
    {
      name: 'inherit resolves to full access',
      inherited: 'full-access' as const,
      icon: 'LockOpen',
      tone: 'danger'
    },
    {
      name: 'inherit resolves to default',
      inherited: 'default' as const,
      icon: 'Lock',
      tone: 'neutral'
    },
    { name: 'inherit has no known resolution', inherited: undefined, icon: 'Lock', tone: 'neutral' }
  ])('shows inherit as the mode it resolves to: $name', ({ inherited, icon, tone }) => {
    expect(mobileAccessDisplay('inherit', inherited)).toEqual({ icon, tone })
  })

  it('ignores the inherited access when the value is explicit', () => {
    expect(mobileAccessDisplay('plan', 'full-access')).toEqual({
      icon: 'NotebookPen',
      tone: 'neutral'
    })
  })
})

describe('mobileAccessCurrentValue', () => {
  it('reads the selected value', () => {
    expect(mobileAccessCurrentValue(accessDescriptor('auto'))).toBe('auto')
  })

  it('falls back to inherit when nothing is selected', () => {
    expect(mobileAccessCurrentValue(accessDescriptor(undefined))).toBe('inherit')
  })
})

describe('mobileAccessDescriptorWithLabels', () => {
  it('replaces raw mode names with human labels and keeps the rest of the descriptor', () => {
    const labelled = mobileAccessDescriptorWithLabels(accessDescriptor('default', 'full-access'))
    expect(labelled.kind).toEqual({
      type: 'select',
      currentValue: 'default',
      choices: [
        { value: 'inherit', label: 'Inherit global setting' },
        { value: 'default', label: 'Ask for approval' },
        { value: 'full-access', label: 'Full access' }
      ]
    })
    expect(labelled.inheritedAccess).toBe('full-access')
    expect(labelled.id).toBe('accessMode')
  })
})
