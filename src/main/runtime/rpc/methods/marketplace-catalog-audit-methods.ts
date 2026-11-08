import {
  MARKETPLACE_CATALOG_AUDIT_METHOD,
  MarketplaceCatalogAuditParams,
  type MarketplaceCatalogAuditResult
} from '../../../../shared/rpc-contract/marketplace-catalog-audit-params'
import { defineMethod } from '../core'

type MarketplaceCatalogAuditRequester = (host: string) => Promise<MarketplaceCatalogAuditResult>

// Why: the desktop installs its renderer requester when a window registers; a headless host has none.
let requester: MarketplaceCatalogAuditRequester | null = null

export function setMarketplaceCatalogAuditRequester(
  next: MarketplaceCatalogAuditRequester | null
): void {
  requester = next
}

export const marketplaceCatalogAuditMethod = defineMethod({
  name: MARKETPLACE_CATALOG_AUDIT_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceCatalogAuditParams,
  handler: async (params): Promise<MarketplaceCatalogAuditResult> => {
    const ask = requester
    return ask ? ask(params.host ?? 'local') : { ok: false, reason: 'no-renderer' }
  }
})

export const MARKETPLACE_CATALOG_AUDIT_METHODS = [marketplaceCatalogAuditMethod]
