import { translate } from '@/i18n/i18n'
import type {
  MarketplaceCatalogAuditRendererResult,
  MarketplaceCatalogAuditRequest,
  MarketplaceCatalogAuditResponse
} from '../../shared/rpc-contract/marketplace-catalog-audit-params'
import {
  auditMarketplaceCatalog,
  type CatalogAuditDeps
} from './components/marketplace/marketplace-catalog-audit'
import {
  readCatalogAuditHostReads,
  readCatalogAuditTargets
} from './components/marketplace/marketplace-catalog-audit-inputs'

/** Answers the main process's audit requests from this window's own store and readers. */
export function attachMarketplaceAuditBridge(): () => void {
  const bridge = window.api?.marketplaceAudit
  if (bridge === undefined) {
    return () => {}
  }
  return bridge.onRequest((request) => {
    void answerMarketplaceAuditRequest(request, runCatalogAudit, (response) =>
      bridge.respond(response)
    )
  })
}

/** Runs one audit and sends its answer back under the request's id. */
export async function answerMarketplaceAuditRequest(
  request: MarketplaceCatalogAuditRequest,
  audit: (host: string) => Promise<MarketplaceCatalogAuditRendererResult>,
  respond: (response: MarketplaceCatalogAuditResponse) => void
): Promise<void> {
  respond({ id: request.id, ok: true, result: await audit(request.host) })
}

async function runCatalogAudit(host: string): Promise<MarketplaceCatalogAuditRendererResult> {
  try {
    return await auditMarketplaceCatalog(host, catalogAuditDeps())
  } catch {
    return { ok: false, reason: 'failed', message: 'The catalog could not be read on this host' }
  }
}

function catalogAuditDeps(): CatalogAuditDeps {
  return {
    thisComputer: translate(
      'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
      'This computer'
    ),
    targets: readCatalogAuditTargets,
    hostReads: readCatalogAuditHostReads
  }
}
