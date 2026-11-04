import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTempHome } from '../main/marketplace/marketplace-apps-test-fixtures'
import { MarketplaceVault } from '../main/marketplace/marketplace-vault'
import type { RelayDispatcher } from './dispatcher'
import { MarketplaceVaultHandler, buildRelayMarketplaceEnv } from './relay-marketplace-vault'

const TOKEN = 'tok-SECRET-123'
let home: string
let vault: MarketplaceVault

type Handler = (params: Record<string, unknown>) => Promise<unknown>

beforeEach(() => {
  home = makeTempHome()
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'ssh-host'
  })
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('relay host vault env', () => {
  it('adds nothing when the host vault is empty', () => {
    expect(buildRelayMarketplaceEnv(vault)).toEqual({})
  })

  it('adds the host own tokens with no client connected', () => {
    vault.writeToken({ kind: 'openmetadata' }, TOKEN)
    vault.writeToken({ kind: 'engram-cloud' }, 'cloud-token')
    expect(buildRelayMarketplaceEnv(vault)).toEqual({
      OPENMETADATA_TOKEN: TOKEN,
      ENGRAM_CLOUD_TOKEN: 'cloud-token'
    })
  })

  it('never throws when the vault cannot be read', () => {
    vault.writeToken({ kind: 'openmetadata' }, TOKEN)
    writeFileSync(join(home, '.orca', 'keys', 'marketplace.key'), 'short')
    // Why: a new vault, because the first one still holds the key it already read.
    const fresh = new MarketplaceVault(join(home, '.orca', 'marketplace'), { sealer: () => null })
    expect(buildRelayMarketplaceEnv(fresh)).toEqual({})
  })
})

describe('relay marketplace.vault.* methods', () => {
  function register(): Map<string, Handler> {
    const handlers = new Map<string, Handler>()
    const dispatcher = {
      onRequest: vi.fn((method: string, handler: Handler) => handlers.set(method, handler))
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only registers request methods.
    new MarketplaceVaultHandler(dispatcher as unknown as RelayDispatcher, vault)
    return handlers
  }

  it('registers the three methods', () => {
    expect([...register().keys()].sort()).toEqual([
      'marketplace.vault.clear',
      'marketplace.vault.set',
      'marketplace.vault.status'
    ])
  })

  it('stores a token and answers with status only, then reads it into the env', async () => {
    const handlers = register()
    const result = await handlers.get('marketplace.vault.set')?.({
      slot: 'openmetadata',
      token: TOKEN
    })
    expect(result).toMatchObject({
      ok: true,
      status: {
        hostLabel: 'ssh-host',
        store: 'key-file',
        credentials: [
          { slot: 'openmetadata', stored: true },
          { slot: 'engram-cloud', stored: false }
        ]
      }
    })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(buildRelayMarketplaceEnv(vault)).toEqual({ OPENMETADATA_TOKEN: TOKEN })
    expect(JSON.stringify(await handlers.get('marketplace.vault.status')?.({}))).not.toContain(
      TOKEN
    )
  })

  it('clears a token', async () => {
    const handlers = register()
    await handlers.get('marketplace.vault.set')?.({ slot: 'engram-cloud', token: TOKEN })
    await handlers.get('marketplace.vault.clear')?.({ slot: 'engram-cloud' })
    expect(buildRelayMarketplaceEnv(vault)).toEqual({})
  })

  it.each([
    ['marketplace.vault.set', { slot: 'github', token: TOKEN }],
    ['marketplace.vault.set', { slot: 'openmetadata', token: 'two words' }],
    ['marketplace.vault.set', { slot: 'openmetadata' }],
    ['marketplace.vault.clear', {}]
  ])('answers invalid-input to %s with %j', async (method, params) => {
    expect(await register().get(method)?.(params)).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(vault.isEmpty()).toBe(true)
  })
})
