import { describe, expect, it } from 'vitest'
import {
  compareModelVersions,
  normalizeCreateChatNaming,
  parseModelVersion,
  selectCreateChatNamingModel,
  type DiscoveredNamingModel
} from './create-chat-session-naming'

const CLAUDE_CATALOG: DiscoveredNamingModel[] = [
  { id: 'haiku', label: 'Haiku' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-opus-5-1', label: 'Opus 5.1' }
]

describe('parseModelVersion', () => {
  it('reads every numeric run in order', () => {
    expect(parseModelVersion('gpt-5.6-terra')).toEqual([5, 6])
    expect(parseModelVersion('claude-sonnet-5-5')).toEqual([5, 5])
    expect(parseModelVersion('sonnet')).toEqual([])
  })
})

describe('compareModelVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareModelVersions([5, 10], [5, 9])).toBeGreaterThan(0)
    expect(compareModelVersions([6, 1], [5, 6])).toBeGreaterThan(0)
    expect(compareModelVersions([5], [5, 0])).toBe(0)
  })
})

describe('selectCreateChatNamingModel', () => {
  it('picks the newest Sonnet by version, not by list order', () => {
    const reordered = [CLAUDE_CATALOG[3], CLAUDE_CATALOG[2], CLAUDE_CATALOG[1], CLAUDE_CATALOG[0]]
    expect(
      selectCreateChatNamingModel({
        agentId: 'claude',
        discoveredModels: reordered,
        pickedModel: 'opus',
        specDefaultModelId: 'sonnet'
      })
    ).toEqual({ kind: 'model', modelId: 'claude-sonnet-5-5' })
  })

  it('uses the Sonnet an older CLI lists', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'claude',
        discoveredModels: [{ id: 'claude-sonnet-4-5' }],
        pickedModel: null,
        specDefaultModelId: 'sonnet'
      })
    ).toEqual({ kind: 'model', modelId: 'claude-sonnet-4-5' })
  })

  it('inherits the CLI default when no Sonnet is listed', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'claude',
        discoveredModels: [{ id: 'haiku' }, { id: 'claude-opus-5-1' }],
        pickedModel: null,
        specDefaultModelId: 'sonnet'
      })
    ).toEqual({ kind: 'inherit' })
  })

  it('inherits when discovery returned nothing', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'claude',
        discoveredModels: [],
        pickedModel: null,
        specDefaultModelId: 'sonnet'
      })
    ).toEqual({ kind: 'inherit' })
  })

  it('picks the newest terra model for Codex', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'codex',
        discoveredModels: [
          { id: 'gpt-5.6-terra' },
          { id: 'gpt-6.1-terra' },
          { id: 'gpt-6.2-codex' }
        ],
        pickedModel: null,
        specDefaultModelId: 'gpt-5.6-terra'
      })
    ).toEqual({ kind: 'model', modelId: 'gpt-6.1-terra' })
  })

  it('falls back to the Codex spec default when no terra model is listed', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'codex',
        discoveredModels: [{ id: 'gpt-5.5' }],
        pickedModel: null,
        specDefaultModelId: 'gpt-5.6-terra'
      })
    ).toEqual({ kind: 'model', modelId: 'gpt-5.6-terra' })
  })

  it('picks the newest Flash for Antigravity and never the default alias', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'antigravity',
        discoveredModels: [
          { id: 'default', label: 'Config default' },
          { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
          { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
          { id: 'argon', label: 'Argon' }
        ],
        pickedModel: null,
        specDefaultModelId: 'default'
      })
    ).toEqual({ kind: 'model', modelId: 'gemini-3.5-flash' })
  })

  it('never returns the Antigravity default alias, even when it is the only entry', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'antigravity',
        discoveredModels: [{ id: 'default', label: 'Flash default' }],
        pickedModel: null,
        specDefaultModelId: 'default'
      })
    ).toEqual({ kind: 'global' })
  })

  it('falls back to the global params when no Flash is listed for Antigravity', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'antigravity',
        discoveredModels: [{ id: 'argon', label: 'Argon' }],
        pickedModel: null,
        specDefaultModelId: 'default'
      })
    ).toEqual({ kind: 'global' })
  })

  it('uses the model picked in create-chat for Gentle Shell, or inherits it', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'pi',
        discoveredModels: [],
        pickedModel: 'anthropic/claude-x',
        specDefaultModelId: undefined
      })
    ).toEqual({ kind: 'model', modelId: 'anthropic/claude-x' })
    expect(
      selectCreateChatNamingModel({
        agentId: 'pi',
        discoveredModels: [],
        pickedModel: null,
        specDefaultModelId: undefined
      })
    ).toEqual({ kind: 'inherit' })
  })

  it('leaves every other agent on the global params', () => {
    expect(
      selectCreateChatNamingModel({
        agentId: 'gemini',
        discoveredModels: [{ id: 'gemini-3-flash' }],
        pickedModel: 'gemini-3-flash',
        specDefaultModelId: 'gemini-3-flash'
      })
    ).toEqual({ kind: 'global' })
  })
})

describe('normalizeCreateChatNaming', () => {
  it('keeps a picked model and treats a blank one as the default pick', () => {
    expect(normalizeCreateChatNaming({ model: 'gpt-5.5' })).toEqual({ model: 'gpt-5.5' })
    expect(normalizeCreateChatNaming({ model: null })).toEqual({ model: null })
    expect(normalizeCreateChatNaming({ model: '  ' })).toEqual({ model: null })
  })

  it('rejects values that are not an override record', () => {
    expect(normalizeCreateChatNaming(undefined)).toBeUndefined()
    expect(normalizeCreateChatNaming('claude')).toBeUndefined()
    expect(normalizeCreateChatNaming({ other: true })).toBeUndefined()
  })
})
