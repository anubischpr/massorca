import { describe, expect, it } from 'vitest'
import type {
  SessionOptionDescriptor,
  SessionOptionSelectChoice
} from '../../../src/shared/native-chat-session-options'
import { splitModelSheet } from './mobile-native-chat-featured-models'

const modelWith = (
  choices: SessionOptionSelectChoice[],
  currentValue?: string
): SessionOptionDescriptor => ({
  id: 'model',
  label: 'Model',
  category: 'model',
  kind: { type: 'select', ...(currentValue === undefined ? {} : { currentValue }), choices },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
})

const valuesOf = (descriptor: SessionOptionDescriptor | null): string[] =>
  descriptor?.kind.type === 'select' ? descriptor.kind.choices.map((choice) => choice.value) : []

// A host's Claude listing: the built-in aliases beside pinned, 1M-context and versioned rows.
const CLAUDE_CHOICES: SessionOptionSelectChoice[] = [
  { value: 'default', label: 'Default (recommended)' },
  { value: 'opus', label: 'Opus' },
  { value: 'opus[1m]', label: 'Opus (1M context)' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'sonnet[1m]', label: 'Sonnet (1M context)' },
  { value: 'haiku', label: 'Haiku' },
  { value: 'fable', label: 'Fable' },
  { value: 'claude-opus-5-5', label: 'Opus 5.5' }
]

const CODEX_CHOICES: SessionOptionSelectChoice[] = [
  { value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
  { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
  { value: 'gpt-6-luna', label: 'GPT-6 Luna' },
  { value: 'gpt-6-sol', label: 'GPT-6 Sol' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  { value: 'gpt-5.5', label: 'GPT-5.5' }
]

const ANTIGRAVITY_CHOICES: SessionOptionSelectChoice[] = [
  { value: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)' },
  { value: 'gemini-4-argon', label: 'Gemini 4 Argon' },
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro' }
]

describe('splitModelSheet', () => {
  it('features the built-in Claude aliases and folds the host rows behind them', () => {
    const split = splitModelSheet(modelWith(CLAUDE_CHOICES), 'claude')
    expect(valuesOf(split.featured)).toEqual(['opus', 'sonnet', 'haiku', 'fable'])
    expect(valuesOf(split.more)).toEqual(['default', 'opus[1m]', 'sonnet[1m]', 'claude-opus-5-5'])
    expect(split.moreCount).toBe(4)
  })

  it('keeps the selected folded model featured at its own place in the list', () => {
    const split = splitModelSheet(modelWith(CLAUDE_CHOICES, 'opus[1m]'), 'claude')
    expect(valuesOf(split.featured)).toEqual(['opus', 'opus[1m]', 'sonnet', 'haiku', 'fable'])
    expect(valuesOf(split.more)).toEqual(['default', 'sonnet[1m]', 'claude-opus-5-5'])
    expect(split.moreCount).toBe(3)
  })

  it('matches Claude rows by value, not by label', () => {
    const split = splitModelSheet(
      modelWith([
        { value: 'claude-haiku', label: 'Haiku' },
        { value: 'sonnet', label: 'Sonnet 5.5' }
      ]),
      'claude'
    )
    expect(valuesOf(split.featured)).toEqual(['sonnet'])
    expect(valuesOf(split.more)).toEqual(['claude-haiku'])
  })

  it('folds nothing when the host lists no built-in Claude alias', () => {
    const descriptor = modelWith([
      { value: 'default', label: 'Default (recommended)' },
      { value: 'claude-opus-5-5', label: 'Opus 5.5' }
    ])
    const split = splitModelSheet(descriptor, 'claude')
    expect(split.featured).toBe(descriptor)
    expect(split.more).toBeNull()
    expect(split.moreCount).toBe(0)
  })

  it('folds nothing when every Claude model is a built-in alias', () => {
    const split = splitModelSheet(
      modelWith([
        { value: 'opus', label: 'Opus' },
        { value: 'sonnet', label: 'Sonnet' },
        { value: 'haiku', label: 'Haiku' },
        { value: 'fable', label: 'Fable' }
      ]),
      'claude'
    )
    expect(split.more).toBeNull()
    expect(split.moreCount).toBe(0)
  })

  it('features Codex 6.1 models and the GPT-6 Astra and Luna variants only', () => {
    const split = splitModelSheet(modelWith(CODEX_CHOICES), 'codex')
    expect(valuesOf(split.featured)).toEqual(['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna'])
    expect(valuesOf(split.more)).toEqual(['gpt-6-sol', 'gpt-5.6-luna', 'gpt-5.5'])
  })

  it('features Gemini 4 Argon and Gemini 3.8 Flash across their effort-suffixed ids', () => {
    const split = splitModelSheet(modelWith(ANTIGRAVITY_CHOICES), 'antigravity')
    expect(valuesOf(split.featured)).toEqual([
      'gemini-4-argon-medium',
      'gemini-4-argon',
      'gemini-3.8-flash'
    ])
    expect(valuesOf(split.more)).toEqual(['claude-sonnet-5-5', 'gemini-3-pro'])
  })

  it('folds nothing for an agent without a featured rule, or with no agent', () => {
    const descriptor = modelWith(CLAUDE_CHOICES)
    expect(splitModelSheet(descriptor, 'gemini').featured).toBe(descriptor)
    expect(splitModelSheet(descriptor, null).featured).toBe(descriptor)
    expect(splitModelSheet(descriptor, 'gemini').more).toBeNull()
  })

  it('does not feature a Codex model whose value and label match only across the join', () => {
    const split = splitModelSheet(
      modelWith([
        { value: 'gpt-6', label: '1 Sol' },
        { value: 'gpt-6-astra', label: 'GPT-6 Astra' }
      ]),
      'codex'
    )
    expect(valuesOf(split.featured)).toEqual(['gpt-6-astra'])
    expect(valuesOf(split.more)).toEqual(['gpt-6'])
  })

  it('leaves an agent-picker model descriptor whole', () => {
    const descriptor: SessionOptionDescriptor = {
      ...modelWith(CLAUDE_CHOICES),
      action: { type: 'agent-picker' }
    }
    expect(splitModelSheet(descriptor, 'claude').featured).toBe(descriptor)
    expect(splitModelSheet(descriptor, 'claude').more).toBeNull()
  })
})
