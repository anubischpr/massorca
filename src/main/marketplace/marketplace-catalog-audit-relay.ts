import type { BrowserWindow } from 'electron'
import {
  MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL,
  MARKETPLACE_CATALOG_AUDIT_RESPONSE_CHANNEL,
  type MarketplaceCatalogAuditRendererResult,
  type MarketplaceCatalogAuditResult
} from '../../shared/rpc-contract/marketplace-catalog-audit-params'
import { requestFromRenderer } from '../window/renderer-request-relay'

// Why: a picked remote host's reads can take up to 30 s each, so the audit outlasts the 20 s mobile relay.
const MARKETPLACE_CATALOG_AUDIT_TIMEOUT_MS = 90_000

export async function requestMarketplaceCatalogAudit(
  mainWindow: BrowserWindow,
  host: string
): Promise<MarketplaceCatalogAuditResult> {
  try {
    return await requestFromRenderer<MarketplaceCatalogAuditRendererResult, { host: string }>(
      mainWindow,
      {
        requestChannel: MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL,
        responseChannel: MARKETPLACE_CATALOG_AUDIT_RESPONSE_CHANNEL,
        timeoutMs: MARKETPLACE_CATALOG_AUDIT_TIMEOUT_MS
      },
      { host }
    )
  } catch (error) {
    return { ok: false, reason: failureReason(error) }
  }
}

function failureReason(error: unknown): 'no-renderer' | 'timeout' | 'failed' {
  const message = error instanceof Error ? error.message : ''
  if (message === 'renderer_unavailable') {
    return 'no-renderer'
  }
  return message === 'renderer_timeout' ? 'timeout' : 'failed'
}
