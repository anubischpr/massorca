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

const CLAUDE_CHOICES: SessionOptionSelectChoice[] = [
  { value: 'claude-opus-5-5', label: 'Opus 5.5' },
  { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { value: 'claude-opus-5-5[1m]', label: 'Opus 5.5 (1M context)' },
  { value: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  { value: 'fable', label: 'Fable 5.1' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
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
  it('features the Claude 5.5 generation and folds Fable 5.1 and the bare aliases', () => {
    const split = splitModelSheet(modelWith(CLAUDE_CHOICES), 'claude')
    expect(valuesOf(split.featured)).toEqual([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-opus-5-5[1m]',
      'claude-haiku-5-5'
    ])
    expect(valuesOf(split.more)).toEqual(['fable', 'opus', 'sonnet', 'haiku'])
    expect(split.moreCount).toBe(4)
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

  it('keeps the selected folded model featured at its own place in the list', () => {
    const choices: SessionOptionSelectChoice[] = [
      { value: 'claude-opus-5-5', label: 'Opus 5.5' },
      { value: 'opus', label: 'Opus' },
      { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' }
    ]
    const split = splitModelSheet(modelWith(choices, 'opus'), 'claude')
    expect(valuesOf(split.featured)).toEqual(['claude-opus-5-5', 'opus', 'claude-sonnet-5-5'])
    expect(valuesOf(split.more)).toEqual([])
    expect(split.more).toBeNull()
  })

  it('folds nothing when the rule matches no model at all', () => {
    const aliasesOnly: SessionOptionSelectChoice[] = [
      { value: 'opus', label: 'Opus' },
      { value: 'haiku', label: 'Haiku' }
    ]
    const descriptor = modelWith(aliasesOnly, 'haiku')
    const split = splitModelSheet(descriptor, 'claude')
    expect(split.featured).toBe(descriptor)
    expect(split.more).toBeNull()
    expect(split.moreCount).toBe(0)
  })

  it('folds nothing when every model already matches the rule', () => {
    const split = splitModelSheet(
      modelWith([
        { value: 'claude-opus-5-5', label: 'Opus 5.5' },
        { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' }
      ]),
      'claude'
    )
    expect(split.more).toBeNull()
    expect(split.moreCount).toBe(0)
  })

  it('folds nothing for an agent without a featured rule, or with no agent', () => {
    const descriptor = modelWith(CLAUDE_CHOICES)
    expect(splitModelSheet(descriptor, 'gemini').featured).toBe(descriptor)
    expect(splitModelSheet(descriptor, null).featured).toBe(descriptor)
    expect(splitModelSheet(descriptor, 'gemini').more).toBeNull()
  })

  it('does not feature a model whose value and label match only across the join', () => {
    const split = splitModelSheet(
      modelWith([
        { value: 'claude-opus-5', label: '5 Fable' },
        { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' }
      ]),
      'claude'
    )
    expect(valuesOf(split.featured)).toEqual(['claude-sonnet-5-5'])
    expect(valuesOf(split.more)).toEqual(['claude-opus-5'])
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
