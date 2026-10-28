import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentSessionOptionsResult } from '../../../src/shared/agent-session-wire'
import { structuredAgentSessionSeedCatalog } from '../../../src/shared/structured-agent-session-seed-catalog'
import { structuredAgentSessionOptionSnapshot } from '../../../src/shared/structured-agent-session-options'
import {
  clearMobileStructuredLastKnownOptionsForTests,
  rememberMobileStructuredLastKnownOptions,
  seedStructuredOptionsFromLastKnown
} from './mobile-structured-last-known-options'

const CODEX_CATALOG = structuredAgentSessionSeedCatalog('codex')

const ANSWER: AgentSessionOptionsResult = {
  models: [
    {
      id: 'gpt-live',
      label: 'GPT Live',
      isDefault: true,
      defaultEffort: 'medium',
      efforts: [
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    }
  ],
  accessModeSupport: { modes: ['default', 'full-access'], settable: true },
  current: {
    model: 'gpt-live',
    effort: 'medium',
    accessMode: 'default',
    confirmed: ['model', 'effort', 'accessMode']
  }
}

function seedFor(key: string) {
  return seedStructuredOptionsFromLastKnown({ agent: 'codex', catalog: CODEX_CATALOG, key })
}

describe('seedStructuredOptionsFromLastKnown', () => {
  beforeEach(() => clearMobileStructuredLastKnownOptionsForTests())

  it('seeds the placeholder when the chat has no remembered answer', () => {
    const { state, answered } = seedFor('chat-1')
    expect(answered).toBe(false)
    expect(state.catalogSource).toBe('seed')
    expect(structuredAgentSessionOptionSnapshot(state).map((entry) => entry.id)).toEqual(['model'])
  })

  it('reseeds the answer the chat last showed, with its model, effort and access', () => {
    rememberMobileStructuredLastKnownOptions('chat-1', ANSWER)
    const { state, answered } = seedFor('chat-1')
    expect(answered).toBe(true)
    expect(state.catalogSource).toBe('live')
    expect(structuredAgentSessionOptionSnapshot(state).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['model', 'effort', 'accessMode'])
    )
  })

  it('keeps each chat’s answer to itself', () => {
    rememberMobileStructuredLastKnownOptions('chat-1', ANSWER)
    expect(seedFor('chat-2').answered).toBe(false)
  })

  it('reseeds the newest answer a chat gave', () => {
    rememberMobileStructuredLastKnownOptions('chat-1', ANSWER)
    rememberMobileStructuredLastKnownOptions('chat-1', {
      ...ANSWER,
      current: { ...ANSWER.current, effort: 'high' }
    })
    const effort = structuredAgentSessionOptionSnapshot(seedFor('chat-1').state).find(
      (entry) => entry.id === 'effort'
    )
    expect(effort?.kind).toMatchObject({ currentValue: 'high' })
  })

  it('drops the least recently answered chat past the bound', () => {
    rememberMobileStructuredLastKnownOptions('chat-0', ANSWER)
    for (let index = 1; index < 32; index += 1) {
      rememberMobileStructuredLastKnownOptions(`chat-${index}`, ANSWER)
    }
    // Answering chat-0 again makes it the newest, so the next overflow drops chat-1.
    rememberMobileStructuredLastKnownOptions('chat-0', ANSWER)
    rememberMobileStructuredLastKnownOptions('chat-32', ANSWER)
    expect(seedFor('chat-1').answered).toBe(false)
    expect(seedFor('chat-0').answered).toBe(true)
    expect(seedFor('chat-32').answered).toBe(true)
  })

  it('seeds the placeholder without a catalog, whatever is remembered', () => {
    rememberMobileStructuredLastKnownOptions('chat-1', ANSWER)
    const { state, answered } = seedStructuredOptionsFromLastKnown({
      agent: 'codex',
      catalog: null,
      key: 'chat-1'
    })
    expect(answered).toBe(false)
    expect(state.catalogSource).toBeNull()
  })
})
