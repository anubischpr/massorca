import { z } from 'zod'

// Why: a new method name, so a host that predates it answers method_not_found, which clients read as "update MassOrca on this host first".
export const MARKETPLACE_CATALOG_AUDIT_METHOD = 'marketplace.catalog.audit'

// Why: the main-to-renderer channels carry the audit request and its answer, never Marketplace state.
export const MARKETPLACE_CATALOG_AUDIT_REQUEST_CHANNEL = 'ui:marketplaceCatalogAuditRequest'
export const MARKETPLACE_CATALOG_AUDIT_RESPONSE_CHANNEL = 'ui:marketplaceCatalogAuditResponse'

const MAX_HOST_KEY_LENGTH = 256

/** A host key as the Marketplace host picker names it; `local` is this computer. */
export const MarketplaceCatalogAuditHost = z.union([
  z.literal('local'),
  z.string().max(MAX_HOST_KEY_LENGTH).regex(/^(ssh|runtime|wsl):.+$/)
])

export const MarketplaceCatalogAuditParams = z.object({
  host: MarketplaceCatalogAuditHost.optional()
})

/** A page's structure as the page descriptor reports it. */
export type MarketplaceCatalogAuditStructure = {
  hostPicker: boolean
  install: boolean
  uninstall: boolean
  connectionConfig: boolean
  accessPolicy: boolean
  sections: { banner: boolean; connection: boolean; advanced: boolean; danger: boolean }
}

export type MarketplaceCatalogAuditPage =
  | { opens: true; pageKind: string }
  | { opens: false; blockedCode: string; blockedReason: string }

export type MarketplaceCatalogAuditRow = {
  key: string
  section: string
  name: string
  status: { kind: string; label: string }
  targetKind: string | null
  page: MarketplaceCatalogAuditPage
  structure: MarketplaceCatalogAuditStructure | null
  source: 'native' | 'external'
  externalDependencies?: string[]
}

export type MarketplaceCatalogAuditHostInfo = { key: string; label: string }

/** The renderer's answer for one host. */
export type MarketplaceCatalogAuditRendererResult =
  | { ok: true; host: MarketplaceCatalogAuditHostInfo; rows: MarketplaceCatalogAuditRow[] }
  | { ok: false; reason: 'invalid-host' | 'failed'; message?: string }

/** The method's answer; the main process adds the two reasons only it can observe. */
export type MarketplaceCatalogAuditResult =
  | { ok: true; host: MarketplaceCatalogAuditHostInfo; rows: MarketplaceCatalogAuditRow[] }
  | {
      ok: false
      reason: 'no-renderer' | 'timeout' | 'invalid-host' | 'failed'
      message?: string
    }

export type MarketplaceCatalogAuditRequest = { id: string; host: string }

export type MarketplaceCatalogAuditResponse =
  | { id: string; ok: true; result: MarketplaceCatalogAuditRendererResult }
  | { id: string; ok: false; error: string }
