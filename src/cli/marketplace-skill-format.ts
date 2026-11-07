import { describeInstallTarget } from './marketplace-skill-host'
import { isSkillInstallProviderId, skillInstallProvider } from '../shared/skill-install-providers'
import type { ManagedSkillInstall, SkillInstallResult } from '../shared/skill-install-contract'

export type MarketplaceSkillAgent = { id: string; name: string }

/** One managed install with the host it sits on and the agents that read it (null: every detected agent). */
export type MarketplaceSkillRow = ManagedSkillInstall & {
  host: string
  agents: MarketplaceSkillAgent[] | null
}

export type MarketplaceSkillCopy = {
  directoryPath: string
  skillFilePath: string
  readers: string[]
}

export type MarketplaceSkillDetail = {
  host: string
  name: string
  install: MarketplaceSkillRow | null
  /** Null: the host could not list folders; `copiesNote` says why. */
  copies: MarketplaceSkillCopy[] | null
  copiesNote?: string
  reconcile?: Pick<SkillInstallResult, 'status' | 'placements'>
}

export function skillAgentName(id: string): string {
  return isSkillInstallProviderId(id) ? (skillInstallProvider(id)?.displayName ?? id) : id
}

export function toSkillRow(install: ManagedSkillInstall, host: string): MarketplaceSkillRow {
  return {
    ...install,
    host,
    agents: install.providers?.map((id) => ({ id, name: skillAgentName(id) })) ?? null
  }
}

function agentsText(row: MarketplaceSkillRow): string {
  if (row.agents === null) {
    return 'every detected agent'
  }
  return row.agents.length === 0 ? '(none)' : row.agents.map((agent) => agent.name).join(', ')
}

export function formatSkillRows(rows: readonly MarketplaceSkillRow[], hostLabel: string): string {
  if (rows.length === 0) {
    return `No Marketplace skills installed on ${hostLabel}.`
  }
  return rows
    .map((row) => {
      const where = describeInstallTarget(row)
      return `${row.name}${where ? ` [${where}]` : ''}: ${row.state}; agents: ${agentsText(row)}`
    })
    .join('\n')
}

export function formatSkillDetail(detail: MarketplaceSkillDetail): string {
  const lines = [`${detail.name} on ${detail.host}`]
  const { install } = detail
  if (install) {
    lines.push(
      `  state: ${install.state}`,
      `  package: ${install.packageId} version ${install.versionId}`,
      `  digest: ${install.packageDigest}`,
      `  installed: ${install.installedAt}`,
      `  agents: ${agentsText(install)}`
    )
  } else {
    lines.push('  not a Marketplace install (no package record on this host)')
  }
  if (detail.copies === null) {
    lines.push(`  folders: unknown${detail.copiesNote ? ` (${detail.copiesNote})` : ''}`)
  } else if (detail.copies.length === 0) {
    lines.push('  folders: none found on this host')
  }
  for (const copy of detail.copies ?? []) {
    lines.push(`  folder: ${copy.directoryPath}`, `    file: ${copy.skillFilePath}`)
    lines.push(`    read by: ${copy.readers.join(', ') || '(unknown)'}`)
  }
  for (const placement of detail.reconcile?.placements ?? []) {
    lines.push(`  ${skillAgentName(placement.provider)}: ${placement.status} (${placement.path})`)
  }
  return lines.join('\n')
}

export function formatSkillInstallOutcome(result: SkillInstallResult): string {
  const lines = [`${result.name}: ${result.status}`]
  for (const placement of result.placements) {
    lines.push(`  ${skillAgentName(placement.provider)}: ${placement.status} (${placement.path})`)
  }
  if (result.conflict) {
    lines.push(
      `  conflict: ${result.conflict.kind}. Re-run with --conflict replace-unmodified or --conflict replace-and-discard-local to overwrite, or --conflict cancel to leave it.`
    )
  }
  const failure = result.failure?.code ?? result.errorCategory
  if (failure) {
    lines.push(`  failure: ${failure}`)
  }
  return lines.join('\n')
}
