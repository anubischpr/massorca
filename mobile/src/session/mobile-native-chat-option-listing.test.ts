import { describe, expect, it } from 'vitest'
import type {
  AgentSessionModelOption,
  AgentSessionOptionsResult
} from '../../../src/shared/agent-session-wire'
import {
  applyStructuredAgentSessionModelCatalog,
  createStructuredAgentSessionOptionState
} from '../../../src/shared/structured-agent-session-options'
import { structuredAgentSessionSeedCatalog } from '../../../src/shared/structured-agent-session-seed-catalog'
import {
  applyStructuredAgentSessionOptionsResult,
  isBuiltInOnlyOptionList
} from './mobile-native-chat-option-listing'

const seed = structuredAgentSessionSeedCatalog('claude')

const option = (id: string): AgentSessionModelOption => ({
  id,
  label: id,
  isDefault: false,
  efforts: []
})

const optionsResult = (
  models: AgentSessionModelOption[],
  current: AgentSessionOptionsResult['current'] = {}
): AgentSessionOptionsResult => ({ models, current })

const BUILT_IN = ['opus', 'sonnet', 'haiku', 'fable'].map(option)
const HOST_LISTING = [
  'default',
  'opus',
  'opus[1m]',
  'sonnet',
  'sonnet[1m]',
  'haiku',
  'fable',
  'claude-opus-5-5'
].map(option)

const idsOf = (models: readonly AgentSessionModelOption[]): string[] =>
  models.map((model) => model.id)

describe('applyStructuredAgentSessionOptionsResult', () => {
  it('records a built-in fallback as builtin, so a host listing that lands later replaces it', () => {
    const start = createStructuredAgentSessionOptionState('claude', seed)
    const fallback = applyStructuredAgentSessionOptionsResult(
      start,
      seed,
      optionsResult(BUILT_IN, { model: 'opus' })
    )
    expect(fallback.catalogSource).toBe('builtin')
    const hosted = applyStructuredAgentSessionModelCatalog(
      fallback,
      seed,
      { origin: 'probe', models: HOST_LISTING },
      { newLaunch: false }
    )
    expect(hosted.catalogSource).toBe('host')
    expect(idsOf(hosted.catalog.models ?? [])).toEqual(idsOf(HOST_LISTING))
  })

  it('keeps a live listing that names a model beyond the built-in ones as live', () => {
    const start = createStructuredAgentSessionOptionState('claude', seed)
    const live = applyStructuredAgentSessionOptionsResult(
      start,
      seed,
      optionsResult([...BUILT_IN, option('opus[1m]'), option('claude-opus-5-5')], {
        model: 'opus'
      })
    )
    expect(live.catalogSource).toBe('live')
    expect(
      applyStructuredAgentSessionModelCatalog(
        live,
        seed,
        { origin: 'probe', models: HOST_LISTING },
        { newLaunch: false }
      )
    ).toBe(live)
  })

  it('does not let a built-in fallback replace the listing the host already applied', () => {
    const start = createStructuredAgentSessionOptionState('claude', seed)
    const hosted = applyStructuredAgentSessionModelCatalog(
      start,
      seed,
      { origin: 'probe', models: HOST_LISTING },
      { newLaunch: false }
    )
    const later = applyStructuredAgentSessionOptionsResult(
      hosted,
      seed,
      optionsResult(BUILT_IN, { model: 'opus' })
    )
    expect(later.catalogSource).toBe('host')
    expect(idsOf(later.catalog.models ?? [])).toEqual(idsOf(HOST_LISTING))
  })

  it('leaves an options read with no models as a live catalog', () => {
    const start = createStructuredAgentSessionOptionState('claude', seed)
    expect(
      applyStructuredAgentSessionOptionsResult(start, seed, optionsResult([])).catalogSource
    ).toBe('live')
  })
})

describe('isBuiltInOnlyOptionList', () => {
  it('ignores the picked model when it lies outside the built-in list', () => {
    expect(
      isBuiltInOnlyOptionList(
        optionsResult([...BUILT_IN, option('claude-x')], { model: 'claude-x' }),
        seed
      )
    ).toBe(true)
  })

  it('is false once the read lists a model beyond the built-in ones', () => {
    expect(isBuiltInOnlyOptionList(optionsResult(HOST_LISTING, { model: 'opus' }), seed)).toBe(
      false
    )
  })
})
