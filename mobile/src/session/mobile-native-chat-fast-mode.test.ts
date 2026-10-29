import { describe, expect, it } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import { isDefaultServiceTier, isMobileFastModeOn } from './mobile-native-chat-fast-mode'

const fastMode = (
  currentValue: boolean,
  valueSource: SessionOptionDescriptor['valueSource'] = 'reported'
): SessionOptionDescriptor => ({
  id: 'fastMode',
  label: 'Fast mode',
  category: 'mode',
  kind: { type: 'boolean', currentValue },
  valueSource,
  transport: 'agent-session',
  settable: true
})

const serviceTier = (currentValue: string | undefined): SessionOptionDescriptor => ({
  id: 'serviceTier',
  label: 'Service tier',
  category: 'mode',
  kind: {
    type: 'select',
    ...(currentValue === undefined ? {} : { currentValue }),
    choices: [
      { value: 'default', label: 'Default' },
      { value: 'priority', label: 'Priority' }
    ]
  },
  valueSource: 'reported',
  transport: 'agent-session',
  settable: true
})

describe('isMobileFastModeOn', () => {
  it.each([
    { name: 'Claude fastMode is on', options: [fastMode(true)], expected: true },
    { name: 'Claude fastMode is off', options: [fastMode(false)], expected: false },
    {
      name: 'a fastMode value nothing reported does not count',
      options: [fastMode(true, 'unknown')],
      expected: false
    },
    {
      name: 'Codex serviceTier is not the default tier',
      options: [serviceTier('priority')],
      expected: true
    },
    {
      name: 'Codex serviceTier is the default tier',
      options: [serviceTier('default')],
      expected: false
    },
    { name: 'Codex serviceTier is unreported', options: [serviceTier(undefined)], expected: false },
    { name: 'no fast-related option at all', options: [], expected: false }
  ])('$name', ({ options, expected }) => {
    expect(isMobileFastModeOn(options)).toBe(expected)
  })
})

describe('isDefaultServiceTier', () => {
  it.each([
    { tier: undefined, expected: true },
    { tier: null, expected: true },
    { tier: '', expected: true },
    { tier: 'default', expected: true },
    { tier: 'priority', expected: false }
  ])('treats $tier as default: $expected', ({ tier, expected }) => {
    expect(isDefaultServiceTier(tier)).toBe(expected)
  })
})
