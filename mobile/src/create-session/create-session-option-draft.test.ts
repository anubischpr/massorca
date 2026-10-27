import { describe, expect, it } from 'vitest'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import {
  applyCreateSessionModelCatalog,
  createCreateSessionOptionDraft,
  createSessionOptionSnapshot,
  pickCreateSessionOption
} from './create-session-option-draft'

const catalog: AgentSessionModelCatalogResult = {
  origin: 'probe',
  fetchedAt: 1,
  models: [
    {
      id: 'opus',
      label: 'Opus',
      isDefault: true,
      efforts: [
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' }
      ]
    },
    { id: 'sonnet', label: 'Sonnet', isDefault: false, efforts: [] }
  ]
}

function ready(agent: string) {
  const draft = createCreateSessionOptionDraft(agent)
  return applyCreateSessionModelCatalog(draft, catalog)
}

describe('create session option draft', () => {
  it('has no pickers for an agent without a structured chat', () => {
    const draft = createCreateSessionOptionDraft('gemini')
    expect(createSessionOptionSnapshot(draft)).toEqual([])
    expect(pickCreateSessionOption(draft, 'model', 'x')).toBeNull()
  })

  it('offers the model and access pickers for a structured agent', () => {
    const ids = createSessionOptionSnapshot(ready('claude')).map((descriptor) => descriptor.id)
    expect(ids).toContain('model')
    expect(ids).toContain('accessMode')
  })

  it('records only what the user picked', () => {
    const draft = ready('claude')
    expect(draft.picks).toEqual({})
    const picked = pickCreateSessionOption(draft, 'accessMode', 'plan')
    expect(picked?.picks).toEqual({ accessMode: 'plan' })
  })

  it('refuses an access mode the pickers do not offer', () => {
    expect(pickCreateSessionOption(ready('claude'), 'accessMode', 'bogus')).toBeNull()
  })

  it('picks a listed model', () => {
    const picked = pickCreateSessionOption(ready('claude'), 'model', 'sonnet')
    expect(picked?.picks.model).toBe('sonnet')
  })

  it('refuses a model the host did not list', () => {
    expect(pickCreateSessionOption(ready('claude'), 'model', 'ghost')).toBeNull()
  })

  it('starts clean when the model changes', () => {
    const withAccess = pickCreateSessionOption(ready('claude'), 'accessMode', 'plan')
    const withModel = withAccess && pickCreateSessionOption(withAccess, 'model', 'opus')
    expect(withModel?.picks).toEqual({ accessMode: 'plan', model: 'opus' })
  })
  it('keeps an effort picked for the chosen model and drops it on the next model', () => {
    const opus = pickCreateSessionOption(ready('claude'), 'model', 'opus')
    const withEffort = opus && pickCreateSessionOption(opus, 'effort', 'high')
    expect(withEffort?.picks).toEqual({ model: 'opus', effort: 'high' })
    const sonnet = withEffort && pickCreateSessionOption(withEffort, 'model', 'sonnet')
    expect(sonnet?.picks).toEqual({ model: 'sonnet' })
  })
})
