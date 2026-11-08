import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MARKETPLACE_CATALOG_AUDIT_METHOD,
  MarketplaceCatalogAuditParams,
  type MarketplaceCatalogAuditResult
} from '../../../../shared/rpc-contract/marketplace-catalog-audit-params'
import type { RpcContext } from '../core'
import { ALL_RPC_METHODS } from './index'
import {
  marketplaceCatalogAuditMethod,
  setMarketplaceCatalogAuditRequester
} from './marketplace-catalog-audit-methods'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the audit handler reads no part of the context.
const context = {} as RpcContext

const ANSWER: MarketplaceCatalogAuditResult = {
  ok: true,
  host: { key: 'local', label: 'This computer' },
  rows: []
}

afterEach(() => {
  setMarketplaceCatalogAuditRequester(null)
})

describe('marketplace.catalog.audit params', () => {
  it('accepts an absent host and each host key shape', () => {
    expect(MarketplaceCatalogAuditParams.safeParse({}).success).toBe(true)
    for (const host of ['local', 'runtime:abc', 'ssh:x', 'wsl:Ubuntu-24.04']) {
      expect(MarketplaceCatalogAuditParams.safeParse({ host }).success).toBe(true)
    }
  })

  it('rejects an unknown prefix, an empty id and a key longer than 256 characters', () => {
    for (const host of ['foo', 'runtime:', `ssh:${'a'.repeat(296)}`]) {
      expect(MarketplaceCatalogAuditParams.safeParse({ host }).success).toBe(false)
    }
  })
})

describe('marketplace.catalog.audit method', () => {
  it('is registered in the host catalog, gated as account administration', () => {
    expect(marketplaceCatalogAuditMethod.name).toBe(MARKETPLACE_CATALOG_AUDIT_METHOD)
    expect(
      ALL_RPC_METHODS.find((m) => m.name === MARKETPLACE_CATALOG_AUDIT_METHOD)?.permission
    ).toBe('accounts-admin')
  })

  it('answers no-renderer without a requester', async () => {
    await expect(
      marketplaceCatalogAuditMethod.handler(MarketplaceCatalogAuditParams.parse({}), context)
    ).resolves.toEqual({ ok: false, reason: 'no-renderer' })
  })

  it('forwards the host, defaulting to local, and returns the requester answer unchanged', async () => {
    const requester = vi.fn<(host: string) => Promise<MarketplaceCatalogAuditResult>>(
      async () => ANSWER
    )
    setMarketplaceCatalogAuditRequester(requester)

    await expect(
      marketplaceCatalogAuditMethod.handler(MarketplaceCatalogAuditParams.parse({}), context)
    ).resolves.toBe(ANSWER)
    expect(requester).toHaveBeenLastCalledWith('local')

    await marketplaceCatalogAuditMethod.handler(
      MarketplaceCatalogAuditParams.parse({ host: 'runtime:abc' }),
      context
    )
    expect(requester).toHaveBeenLastCalledWith('runtime:abc')
  })
})
