import { describe, expect, it } from 'vitest'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
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

function ready(agent: string, piRuntime: PiRuntimeSelection | null = null) {
  const draft = createCreateSessionOptionDraft(agent, '', piRuntime)
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
  it('offers Codex only the presets it declares', () => {
    const codex = ready('codex')
    expect(pickCreateSessionOption(codex, 'accessMode', 'plan')).toBeNull()
    expect(pickCreateSessionOption(codex, 'accessMode', 'accept-edits')).toBeNull()
    expect(pickCreateSessionOption(codex, 'accessMode', 'read-only')?.picks).toEqual({
      accessMode: 'read-only'
    })
    expect(pickCreateSessionOption(codex, 'accessMode', 'full-access')?.picks.accessMode).toBe(
      'full-access'
    )
  })

  it('does not offer Claude the Codex-only read-only preset', () => {
    expect(pickCreateSessionOption(ready('claude'), 'accessMode', 'read-only')).toBeNull()
    expect(pickCreateSessionOption(ready('claude'), 'accessMode', 'plan')).not.toBeNull()
  })

  it('offers stock Pi model pickers and no access choice', () => {
    const ids = createSessionOptionSnapshot(ready('pi', 'pi')).map((descriptor) => descriptor.id)
    expect(ids).toContain('model')
    expect(ids).not.toContain('accessMode')
  })

  it('offers Gentle Shell only the default and full-access modes it runs', () => {
    const gentleShell = ready('pi', 'gentle-shell')
    expect(pickCreateSessionOption(gentleShell, 'accessMode', 'auto')).toBeNull()
    expect(pickCreateSessionOption(gentleShell, 'accessMode', 'default')?.picks).toEqual({
      accessMode: 'default'
    })
    expect(pickCreateSessionOption(gentleShell, 'accessMode', 'full-access')?.picks).toEqual({
      accessMode: 'full-access'
    })
  })

  it('offers Antigravity the presets its host declares', () => {
    const antigravity = ready('antigravity')
    expect(pickCreateSessionOption(antigravity, 'accessMode', 'plan')?.picks).toEqual({
      accessMode: 'plan'
    })
    expect(pickCreateSessionOption(antigravity, 'accessMode', 'read-only')).toBeNull()
  })

  it('offers Antigravity a model pick only once its host lists models', () => {
    const unlisted = applyCreateSessionModelCatalog(createCreateSessionOptionDraft('antigravity'), {
      origin: 'unknown'
    })
    expect(createSessionOptionSnapshot(unlisted).map((d) => d.id)).not.toContain('model')
    expect(pickCreateSessionOption(unlisted, 'model', 'opus')).toBeNull()
    expect(createSessionOptionSnapshot(ready('antigravity')).map((d) => d.id)).toContain('model')
  })

  it('starts over when the host or project changes', () => {
    const picked = pickCreateSessionOption(ready('claude'), 'accessMode', 'plan')
    expect(picked?.scope).toBe('')
    expect(createCreateSessionOptionDraft('claude', 'ssh:vps|web').picks).toEqual({})
  })
})
