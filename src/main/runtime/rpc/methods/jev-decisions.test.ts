import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JEV_DECISIONS_METHODS } from './jev-decisions'

const store = vi.hoisted(() => ({
  clearJevApiKey: vi.fn(),
  saveJevApiKey: vi.fn(),
  readJevApiKeyStatus: vi.fn(() => ({
    apiKeyConfigured: true,
    apiKeyUnreadable: false,
    apiKeyProtection: 'plaintext'
  }))
}))

vi.mock('../../../jev/jev-api-key-store', () => store)

function method(name: string) {
  const found = JEV_DECISIONS_METHODS.find((entry) => entry.name === name)
  if (!found) {
    throw new Error(`no method ${name}`)
  }
  return found
}

function call(name: string, params: unknown, runtime: unknown): unknown {
  const invoke = method(name).handler as unknown as (
    params: unknown,
    context: { runtime: unknown }
  ) => unknown
  return invoke(params, { runtime })
}

describe('jevDecisions RPC', () => {
  const runtime = {
    isJevDecisionsEnabled: vi.fn(() => true),
    setJevDecisionsEnabled: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves the key on this host and never returns its value', () => {
    const result = call('jevDecisions.saveApiKey', { apiKey: 'test-jev-key' }, runtime)

    expect(store.saveJevApiKey).toHaveBeenCalledWith('test-jev-key')
    expect(JSON.stringify(result)).not.toContain('test-jev-key')
    expect(result).toMatchObject({ apiKeyConfigured: true, enabled: true })
  })

  it('reports the host switch with the key status', () => {
    expect(call('jevDecisions.getStatus', undefined, runtime)).toEqual({
      apiKeyConfigured: true,
      apiKeyUnreadable: false,
      apiKeyProtection: 'plaintext',
      enabled: true
    })
  })

  it('sets the host switch', () => {
    call('jevDecisions.setEnabled', { enabled: false }, runtime)

    expect(runtime.setJevDecisionsEnabled).toHaveBeenCalledWith(false)
  })

  it('turns the host switch off when the key is removed', () => {
    call('jevDecisions.clearApiKey', undefined, runtime)

    expect(store.clearJevApiKey).toHaveBeenCalledOnce()
    expect(runtime.setJevDecisionsEnabled).toHaveBeenCalledWith(false)
  })

  it('declares admin permissions, so a phone or SSH host cannot reach them', () => {
    expect(JEV_DECISIONS_METHODS.map((entry) => [entry.name, entry.permission])).toEqual([
      ['jevDecisions.getStatus', 'accounts-admin'],
      ['jevDecisions.saveApiKey', 'accounts-admin'],
      ['jevDecisions.clearApiKey', 'accounts-admin'],
      ['jevDecisions.setEnabled', 'settings-write']
    ])
  })
})
