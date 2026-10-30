import { describe, expect, it } from 'vitest'
import type {
  SessionOptionDescriptor,
  SessionOptionSelectChoice
} from './native-chat-session-options'
import {
  featuredModelAgentFor,
  featuredModelDisplay,
  splitFeaturedModels,
  splitModelSheet
} from './native-chat-featured-models'

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

const GENTLE_SHELL_CHOICES: SessionOptionSelectChoice[] = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'glm-5.2', label: 'GLM-5.2' },
  { value: 'zai-coding-plan/glm-5.3-flash', label: 'GLM-5.3 Flash' }
]

describe('splitModelSheet', () => {
  it('features the built-in Claude aliases in the prototype order and folds the host rows', () => {
    const split = splitModelSheet(modelWith(CLAUDE_CHOICES), 'claude')
    expect(valuesOf(split.featured)).toEqual(['fable', 'opus', 'sonnet', 'haiku'])
    expect(valuesOf(split.more)).toEqual(['default', 'opus[1m]', 'sonnet[1m]', 'claude-opus-5-5'])
    expect(split.moreCount).toBe(4)
  })

  it('keeps the selected folded model in the main list after the featured set', () => {
    const split = splitModelSheet(modelWith(CLAUDE_CHOICES, 'opus[1m]'), 'claude')
    expect(valuesOf(split.featured)).toEqual(['fable', 'opus', 'sonnet', 'haiku', 'opus[1m]'])
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

  it('features Codex models in the prototype order and folds the rest', () => {
    const split = splitModelSheet(modelWith(CODEX_CHOICES), 'codex')
    expect(valuesOf(split.featured)).toEqual(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna'])
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

  it('features the Gentle Shell DeepSeek Flash and GLM Flash models and folds the rest', () => {
    const split = splitModelSheet(modelWith(GENTLE_SHELL_CHOICES), 'gentle-shell')
    expect(valuesOf(split.featured)).toEqual(['deepseek-v4-flash', 'zai-coding-plan/glm-5.3-flash'])
    expect(valuesOf(split.more)).toEqual(['deepseek-v4-pro', 'glm-5.2'])
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

describe('featuredModelAgentFor', () => {
  it('gives a featured set to Claude, Codex, Antigravity and Gentle Shell only', () => {
    expect(featuredModelAgentFor('claude')).toBe('claude')
    expect(featuredModelAgentFor('codex')).toBe('codex')
    expect(featuredModelAgentFor('antigravity')).toBe('antigravity')
    expect(featuredModelAgentFor('pi', 'gentle-shell')).toBe('gentle-shell')
    expect(featuredModelAgentFor('pi', 'pi')).toBeNull()
    expect(featuredModelAgentFor('pi', 'unknown')).toBeNull()
    expect(featuredModelAgentFor('gemini')).toBeNull()
    expect(featuredModelAgentFor(null)).toBeNull()
  })
})

describe('splitFeaturedModels', () => {
  it('shows the live description and falls back to the prototype text only without one', () => {
    const split = splitFeaturedModels(
      [
        { value: 'sonnet', label: 'Sonnet', description: 'Live sonnet text' },
        { value: 'haiku', label: 'Haiku' }
      ],
      'claude'
    )
    expect(split?.featured.map((row) => row.display)).toEqual([
      { name: 'Sonnet', detail: '5.5 · Live sonnet text' },
      { name: 'Haiku', detail: '5.5 · Fastest for quick answers' }
    ])
  })

  it('shows a folded model under its live label and description only', () => {
    const split = splitFeaturedModels(
      [
        { value: 'opus', label: 'Opus' },
        { value: 'opus[1m]', label: 'Opus (1M context)', description: 'Live 1M text' },
        { value: 'sonnet[1m]', label: 'Sonnet (1M context)' }
      ],
      'claude'
    )
    expect(split?.more.map((row) => row.display)).toEqual([
      { name: 'Opus (1M context)', detail: 'Live 1M text' },
      { name: 'Sonnet (1M context)', detail: undefined }
    ])
  })

  it('reads a featured model as its name alone, with the version on the detail line', () => {
    expect(featuredModelDisplay({ value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' }, 'codex')).toEqual({
      name: 'Sol',
      detail: '6.1 · Latest workhorse model for coding and everyday work'
    })
    expect(
      featuredModelDisplay({ value: 'opus[1m]', label: 'Opus (1M context)' }, 'claude')
    ).toEqual({ name: 'Opus (1M context)', detail: undefined })
  })

  it('shows a Gentle Shell model with its version and description', () => {
    const split = splitFeaturedModels(GENTLE_SHELL_CHOICES, 'gentle-shell')
    expect(split?.featured.map((row) => row.display.name)).toEqual(['DeepSeek Flash', 'GLM Flash'])
    expect(split?.featured[1]?.display.detail).toBe('5.3 · Fast and affordable for quick tasks')
  })
})
