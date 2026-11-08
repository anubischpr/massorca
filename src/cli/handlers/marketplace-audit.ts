import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { marketplaceHostParam, resolveMarketplaceSkillHost } from '../marketplace-skill-host'
import { callMarketplaceHost } from './marketplace-host-call'

const AUDIT_METHOD = 'marketplace.catalog.audit'
// Why: the host relays to its renderer for up to 90 s; the 60 s CLI default would cut it off first.
const AUDIT_TIMEOUT_MS = 100_000

type AuditStructure = {
  hostPicker: boolean
  install: boolean
  uninstall: boolean
  connectionConfig: boolean
  accessPolicy: boolean
  sections: { banner: boolean; connection: boolean; advanced: boolean; danger: boolean }
}

export type MarketplaceAuditRow = {
  key: string
  section: string
  name: string
  status: { kind: string; label: string }
  targetKind: string | null
  page: { opens: boolean; pageKind?: string; blockedCode?: string; blockedReason?: string }
  structure: AuditStructure
  source: 'native' | 'external'
  externalDependencies?: string[]
}

type MarketplaceAudit =
  | { ok: true; host: { key: string; label: string }; rows: MarketplaceAuditRow[] }
  | { ok: false; reason: string; message?: string }

const NO_RENDERER =
  'This host has no desktop window open, so it cannot compute the Marketplace page. Open MassOrca on the host and retry.'

function formatStructure(structure: AuditStructure): string {
  const flags = [
    ['host picker', structure.hostPicker],
    ['install', structure.install],
    ['uninstall', structure.uninstall],
    ['connection', structure.connectionConfig],
    ['access policy', structure.accessPolicy]
  ]
    .filter(([, on]) => on)
    .map(([label]) => label)
  const sections = Object.entries(structure.sections)
    .filter(([, on]) => on)
    .map(([name]) => name)
  return `has: ${flags.join(', ') || 'nothing'}; sections: ${sections.join(', ') || 'none'}`
}

export function formatAuditRow(row: MarketplaceAuditRow): string {
  const page = row.page.opens
    ? `opens → ${row.page.pageKind ?? 'page'}`
    : `blocked (${row.page.blockedCode ?? 'unknown'}): ${row.page.blockedReason ?? 'no reason given'}`
  const external = row.externalDependencies?.length
    ? ` (needs ${row.externalDependencies.join(', ')})`
    : ''
  return [
    `${row.section} / ${row.name}: ${page}`,
    `  ${row.status.label}; ${formatStructure(row.structure)}; ${row.source}${external}`
  ].join('\n')
}

export const MARKETPLACE_AUDIT_HANDLERS: Record<string, CommandHandler> = {
  'marketplace audit': async (ctx) => {
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const param = marketplaceHostParam(host)
    const response = await callMarketplaceHost<MarketplaceAudit>(
      ctx,
      AUDIT_METHOD,
      param ? { host: param } : {},
      { timeoutMs: AUDIT_TIMEOUT_MS }
    )
    const audit = response.result
    if (!audit.ok) {
      const detail = audit.reason === 'no-renderer' ? NO_RENDERER : (audit.message ?? '')
      throw new RuntimeClientError(
        'runtime_error',
        `The host could not audit the Marketplace: ${audit.reason}${detail ? ` (${detail})` : ''}`
      )
    }
    if (ctx.flags.has('strict') && audit.rows.some((row) => !row.page.opens)) {
      process.exitCode = 1
    }
    printResult({ ...response, result: audit }, ctx.json, (value) =>
      [`Marketplace on ${value.host.label}:`, ...value.rows.map(formatAuditRow)].join('\n')
    )
  }
}
