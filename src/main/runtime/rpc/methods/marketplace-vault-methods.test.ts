import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MarketplaceVaultClear,
  MarketplaceVaultSet
} from '../../../../shared/rpc-contract/marketplace-vault-params'
import { MarketplaceVault } from '../../../marketplace/marketplace-vault'
import { makeTempHome } from '../../../marketplace/marketplace-apps-test-fixtures'
import type { RpcContext } from '../core'
import { ALL_RPC_METHODS } from './index'
import {
  marketplaceVaultClearMethod,
  marketplaceVaultHost,
  marketplaceVaultSetMethod,
  marketplaceVaultStatusMethod
} from './marketplace-vault-methods'

const TOKEN = 'tok-SECRET-123'
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers read no part of the context.
const context = {} as RpcContext
let home: string
const original = marketplaceVaultHost.vault

beforeEach(() => {
  home = makeTempHome()
  // A plain Node host: no keychain, so the key is a file.
  const vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'srv2056164'
  })
  marketplaceVaultHost.vault = () => vault
})
afterEach(() => {
  marketplaceVaultHost.vault = original
  rmSync(home, { recursive: true, force: true })
})

describe('marketplace.vault.* methods', () => {
  it('is part of the host catalog and gated as account administration', () => {
    for (const name of ['status', 'set', 'clear']) {
      const registered = ALL_RPC_METHODS.find((m) => m.name === `marketplace.vault.${name}`)
      expect(registered?.permission).toBe('accounts-admin')
    }
  })

  it('sets a token write-only and reports set, updated time and location', async () => {
    const params = MarketplaceVaultSet.parse({ slot: 'openmetadata', token: TOKEN })
    const result = await marketplaceVaultSetMethod.handler(params, context)
    expect(result).toEqual({
      ok: true,
      status: {
        hostLabel: 'srv2056164',
        store: 'key-file',
        credentials: [
          { slot: 'openmetadata', stored: true, updatedAt: expect.any(Number) },
          { slot: 'engram-cloud', stored: false }
        ]
      }
    })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    const status = await marketplaceVaultStatusMethod.handler(undefined, context)
    expect(JSON.stringify(status)).not.toContain(TOKEN)
  })

  it('clears a token', async () => {
    await marketplaceVaultSetMethod.handler({ slot: 'engram-cloud', token: TOKEN }, context)
    const cleared = await marketplaceVaultClearMethod.handler(
      MarketplaceVaultClear.parse({ slot: 'engram-cloud' }),
      context
    )
    expect(cleared).toMatchObject({
      ok: true,
      status: {
        credentials: [
          { slot: 'openmetadata', stored: false },
          { slot: 'engram-cloud', stored: false }
        ]
      }
    })
  })

  it('refuses a token that cannot sit in a header or an env var', async () => {
    for (const token of ['two words', 'línea', 'x'.repeat(9000)]) {
      const parsed = MarketplaceVaultSet.safeParse({ slot: 'openmetadata', token })
      const result = parsed.success
        ? await marketplaceVaultSetMethod.handler(parsed.data, context)
        : { ok: false, reason: 'invalid-input' }
      expect(result).toEqual({ ok: false, reason: 'invalid-input' })
    }
  })

  it('rejects an unknown slot at the schema', () => {
    expect(MarketplaceVaultSet.safeParse({ slot: 'github', token: TOKEN }).success).toBe(false)
  })
})
