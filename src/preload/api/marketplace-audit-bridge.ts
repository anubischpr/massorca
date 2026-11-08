import { ipcRenderer } from 'electron'
import {
  MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL,
  MARKETPLACE_CATALOG_AUDIT_RESPONSE_CHANNEL,
  type MarketplaceCatalogAuditRequest,
  type MarketplaceCatalogAuditResponse
} from '../../shared/rpc-contract/marketplace-catalog-audit-params'

export type MarketplaceAuditBridgeApi = {
  onRequest: (callback: (request: MarketplaceCatalogAuditRequest) => void) => () => void
  respond: (response: MarketplaceCatalogAuditResponse) => void
}

export const marketplaceAuditBridgeApi: MarketplaceAuditBridgeApi = {
  onRequest: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: MarketplaceCatalogAuditRequest
    ): void => callback(request)
    ipcRenderer.on(MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL, listener)
    }
  },
  respond: (response) => {
    ipcRenderer.send(MARKETPLACE_CATALOG_AUDIT_RESPONSE_CHANNEL, response)
  }
}
