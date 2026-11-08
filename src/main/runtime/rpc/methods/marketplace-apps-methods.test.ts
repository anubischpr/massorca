import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MarketplaceAppsConnect,
  MarketplaceAppsSetAccessPolicy
} from '../../../../shared/rpc-contract/marketplace-apps-params'
import {
  installAllAgents,
  makeTempHome,
  testAgentPaths
} from '../../../marketplace/marketplace-apps-test-fixtures'
import { createMarketplaceAppsService } from '../../../marketplace/marketplace-apps-service'
import { MarketplaceVault } from '../../../marketplace/marketplace-vault'
import { MOBILE_RPC_METHOD_ALLOWLIST } from '../../runtime-rpc/runtime-rpc-mobile-method-allowlist'
import type { RpcContext } from '../core'
import { ALL_RPC_METHODS } from './index'
import {
  MARKETPLACE_APPS_METHODS,
  marketplaceAppsConnectMethod,
  marketplaceAppsHost,
  marketplaceAppsListMethod
} from './marketplace-apps-methods'

const TOKEN = 'tok-SECRET-123'
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers read no part of the context.
const context = {} as RpcContext
let home: string
const original = marketplaceAppsHost.service

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  const vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'srv2056164'
  })
  const service = createMarketplaceAppsService({
    vault,
    paths: testAgentPaths(home),
    engramProgram: async () => ({ found: false, version: null }),
    githubAuthenticated: async () => false
  })
  marketplaceAppsHost.service = () => service
})
afterEach(() => {
  marketplaceAppsHost.service = original
  rmSync(home, { recursive: true, force: true })
})

describe('marketplace.apps.* methods', () => {
  it('is part of the host catalog and gated as account administration', () => {
    expect(MARKETPLACE_APPS_METHODS).toHaveLength(8)
    for (const method of MARKETPLACE_APPS_METHODS) {
      const registered = ALL_RPC_METHODS.find((m) => m.name === method.name)
      expect(registered?.permission).toBe('accounts-admin')
    }
  })

  it('lets a phone list, connect and set keys, and keeps every other change desktop-only', () => {
    const phone = new Set([
      'marketplace.apps.list',
      'marketplace.apps.connect',
      'marketplace.apps.setOpenMetadataToken',
      'marketplace.apps.setEngramServer',
      'marketplace.apps.setAccessPolicy'
    ])
    for (const method of MARKETPLACE_APPS_METHODS) {
      expect(MOBILE_RPC_METHOD_ALLOWLIST.has(method.name), method.name).toBe(phone.has(method.name))
    }
  })

  it('connects OpenMetadata on this host and never answers with the token', async () => {
    const params = MarketplaceAppsConnect.parse({
      id: 'openmetadata',
      url: 'https://om.example.com/mcp',
      token: TOKEN
    })
    const result = await marketplaceAppsConnectMethod.handler(params, context)
    expect(result).toMatchObject({
      ok: true,
      status: {
        id: 'openmetadata',
        credential: { stored: true, location: { hostLabel: 'srv2056164', store: 'key-file' } }
      }
    })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    const listed = await marketplaceAppsListMethod.handler(undefined, context)
    expect(JSON.stringify(listed)).not.toContain(TOKEN)
  })

  it('validates arguments at the schema and again in the service', async () => {
    expect(MarketplaceAppsConnect.safeParse({ id: 'openmetadata', url: 'x' }).success).toBe(false)
    expect(MarketplaceAppsConnect.safeParse({ id: 'nope' }).success).toBe(false)
    const parsed = MarketplaceAppsConnect.parse({
      id: 'openmetadata',
      url: 'ftp://x',
      token: TOKEN
    })
    expect(await marketplaceAppsConnectMethod.handler(parsed, context)).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    const bad = MarketplaceAppsSetAccessPolicy.safeParse({
      id: 'engram',
      policy: {
        agents: { mode: 'only', ids: ['pi'] },
        bots: { mode: 'everyone', botIds: [], teamIds: [] }
      }
    })
    expect(bad.success).toBe(false)
  })
})
