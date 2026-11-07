import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MarketplaceServiceConnect,
  MarketplaceServiceDisconnect
} from '../../../../shared/rpc-contract/marketplace-service-params'
import { makeTempHome } from '../../../marketplace/marketplace-apps-test-fixtures'
import { storedServiceCredentials } from '../../../marketplace/marketplace-service-credentials'
import type * as MarketplaceServicesModule from '../../../marketplace/marketplace-services'
import { MarketplaceVault } from '../../../marketplace/marketplace-vault'
import type { RpcContext } from '../core'
import { ALL_RPC_METHODS } from './index'
import {
  marketplaceServiceConnectMethod,
  marketplaceServiceDisconnectMethod,
  marketplaceServiceStatusMethod
} from './marketplace-service-methods'
import { marketplaceVaultHost } from './marketplace-vault-methods'

vi.mock('../../../marketplace/marketplace-services', async (importOriginal) => {
  const original = await importOriginal<typeof MarketplaceServicesModule>()
  const deps = {
    glabStatus: async () => ({ installed: false, authenticated: false }),
    glabLogin: async () => 'ok' as const,
    forgetCachedChecks: () => undefined
  }
  return {
    ...original,
    readMarketplaceServices: (vault: never) => original.readMarketplaceServices(vault, deps),
    connectMarketplaceService: (vault: never, args: unknown) =>
      original.connectMarketplaceService(vault, args, deps),
    disconnectMarketplaceService: (vault: never, args: unknown) =>
      original.disconnectMarketplaceService(vault, args, deps)
  }
})
vi.mock('../../../bitbucket/credential-connection', () => ({
  connectBitbucket: vi.fn(),
  disconnectBitbucket: vi.fn(),
  getBitbucketConnectionStatus: () => ({
    configured: false,
    source: 'none',
    account: null,
    authMode: null,
    email: null,
    baseUrl: null
  })
}))

const TOKEN = 'tok-SECRET-123'
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers read no part of the context.
const context = {} as RpcContext
let home: string
const original = marketplaceVaultHost.vault
const originalStored = storedServiceCredentials.vault

beforeEach(() => {
  home = makeTempHome()
  const vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'srv2056164'
  })
  marketplaceVaultHost.vault = () => vault
  storedServiceCredentials.vault = () => vault
})
afterEach(() => {
  marketplaceVaultHost.vault = original
  storedServiceCredentials.vault = originalStored
  rmSync(home, { recursive: true, force: true })
})

describe('marketplace.service.* methods', () => {
  it('is part of the host catalog and gated as account administration', () => {
    for (const name of ['status', 'connect', 'disconnect']) {
      const registered = ALL_RPC_METHODS.find((m) => m.name === `marketplace.service.${name}`)
      expect(registered?.permission).toBe('accounts-admin')
    }
  })

  it('accepts only the documented params, token and address optional beyond service and token', () => {
    expect(MarketplaceServiceConnect.safeParse({ service: 'gitea', token: TOKEN }).success).toBe(
      true
    )
    expect(MarketplaceServiceConnect.safeParse({ service: 'jira', token: TOKEN }).success).toBe(
      false
    )
    expect(MarketplaceServiceConnect.safeParse({ service: 'gitea', token: '' }).success).toBe(false)
    expect(MarketplaceServiceDisconnect.safeParse({ service: 'gitlab' }).success).toBe(true)
  })

  it('connects write-only, reports the service as stored, and disconnects', async () => {
    const connected = await marketplaceServiceConnectMethod.handler(
      MarketplaceServiceConnect.parse({
        service: 'azure-devops',
        token: TOKEN,
        baseUrl: 'https://dev.azure.com/acme'
      }),
      context
    )
    expect(connected).toMatchObject({
      ok: true,
      status: {
        hostLabel: 'srv2056164',
        store: 'key-file',
        services: expect.arrayContaining([
          expect.objectContaining({
            service: 'azure-devops',
            source: 'stored',
            baseUrl: 'https://dev.azure.com/acme'
          })
        ])
      }
    })
    expect(JSON.stringify(connected)).not.toContain(TOKEN)
    const status = await marketplaceServiceStatusMethod.handler(undefined, context)
    expect(JSON.stringify(status)).not.toContain(TOKEN)

    const cleared = await marketplaceServiceDisconnectMethod.handler(
      MarketplaceServiceDisconnect.parse({ service: 'azure-devops' }),
      context
    )
    expect(JSON.stringify(cleared)).toContain('"source":"none"')
  })

  it('answers invalid-input for a token the host cannot use', async () => {
    const result = await marketplaceServiceConnectMethod.handler(
      MarketplaceServiceConnect.parse({ service: 'gitea', token: 'has space inside' }),
      context
    )
    expect(result).toEqual({ ok: false, reason: 'invalid-input' })
  })
})
