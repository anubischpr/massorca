import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type {
  MarketplaceCatalogAuditRendererResult,
  MarketplaceCatalogAuditRow
} from '../../../../shared/rpc-contract/marketplace-catalog-audit-params'
import { catalogBuildInputsFor, type CatalogHostReads } from './MarketplaceCatalogData'
import { buildCatalogSections, type CatalogRow } from './MarketplaceCatalogRows'
import { MARKETPLACE_PAGE_STRUCTURE, marketplaceRowSource } from './marketplace-page-structure'
import {
  MARKETPLACE_ROW_BLOCK_TEXT,
  resolveMarketplaceRowPage,
  type MarketplaceRowPageHost,
  type MarketplaceSkillScan
} from './marketplace-row-page-resolver'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { marketplaceHostKey } from './use-marketplace-host-targets'

/** The reads an audit makes: the picker's host list, one host's inputs, and its skill scan. */
export type CatalogAuditDeps = {
  thisComputer: string
  targets: () => Promise<readonly MarketplaceVaultHostTarget[]>
  hostReads: (
    pickedTarget: MarketplaceVaultHostTarget | null,
    hostLabel: string
  ) => Promise<{ reads: CatalogHostReads; skillTarget: RuntimeClientTarget | null }>
  scan?: MarketplaceSkillScan
}

export type AuditHostChoice =
  | { ok: true; pickedTarget: MarketplaceVaultHostTarget | null }
  | { ok: false; message: string }

/** The host a key names: this computer for `local`, otherwise a host the picker lists. Unknown keys never fall back. */
export function resolveAuditHost(
  hostKey: string,
  targets: readonly MarketplaceVaultHostTarget[]
): AuditHostChoice {
  if (hostKey === 'local') {
    return { ok: true, pickedTarget: null }
  }
  const target = targets.find((candidate) => marketplaceHostKey(candidate) === hostKey)
  if (target !== undefined) {
    return { ok: true, pickedTarget: target }
  }
  const runtimeId = hostKey.startsWith('runtime:') ? hostKey.slice('runtime:'.length) : null
  return {
    ok: false,
    message:
      runtimeId !== null
        ? `No paired host ${runtimeId} on this computer`
        : `No host ${hostKey} on this computer`
  }
}

/** Audits every catalog row of one host with the page's own builders and resolver. */
export async function auditMarketplaceCatalog(
  hostKey: string,
  deps: CatalogAuditDeps
): Promise<MarketplaceCatalogAuditRendererResult> {
  const choice = resolveAuditHost(hostKey, await deps.targets())
  if (!choice.ok) {
    return { ok: false, reason: 'invalid-host', message: choice.message }
  }
  const label = choice.pickedTarget?.label ?? deps.thisComputer
  try {
    const { reads, skillTarget } = await deps.hostReads(choice.pickedTarget, label)
    const host: MarketplaceRowPageHost = {
      pickedTarget: choice.pickedTarget,
      focusedRuntime: skillTarget
    }
    const rows = await auditRows(reads, host, scanOnce(deps.scan ?? discoverSkillsForPickedHost))
    return { ok: true, host: { key: hostKey, label }, rows }
  } catch {
    return { ok: false, reason: 'failed', message: 'The catalog could not be read on this host' }
  }
}

/** One scan per audit: every skill row reads the same answer, so the host is scanned once. */
function scanOnce(scan: MarketplaceSkillScan): MarketplaceSkillScan {
  let answer: ReturnType<MarketplaceSkillScan> | undefined
  return (pickedTarget, focusedRuntime) => {
    if (answer === undefined) {
      answer = scan(pickedTarget, focusedRuntime)
    }
    return answer
  }
}

async function auditRows(
  reads: CatalogHostReads,
  host: MarketplaceRowPageHost,
  scan: MarketplaceSkillScan
): Promise<MarketplaceCatalogAuditRow[]> {
  const sections = buildCatalogSections(catalogBuildInputsFor(reads).inputs)
  return Promise.all(
    sections.flatMap((section) => section.rows).map((row) => auditRow(row, host, scan))
  )
}

async function auditRow(
  row: CatalogRow,
  host: MarketplaceRowPageHost,
  scan: MarketplaceSkillScan
): Promise<MarketplaceCatalogAuditRow> {
  const resolution = await resolveMarketplaceRowPage(row, host, scan)
  const source = marketplaceRowSource(row)
  return {
    key: row.key,
    section: row.section,
    name: row.name,
    status: { kind: row.status.kind, label: row.status.label },
    targetKind: row.target?.kind ?? null,
    page: resolution.opens
      ? { opens: true, pageKind: resolution.pageKind }
      : {
          opens: false,
          blockedCode: resolution.reason,
          blockedReason: MARKETPLACE_ROW_BLOCK_TEXT[resolution.reason]
        },
    structure: resolution.opens ? MARKETPLACE_PAGE_STRUCTURE[resolution.pageKind] : null,
    source: source.source,
    ...(source.source === 'external'
      ? { externalDependencies: [...source.externalDependencies] }
      : {})
  }
}
