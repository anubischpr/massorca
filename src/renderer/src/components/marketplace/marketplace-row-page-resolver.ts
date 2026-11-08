import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { SkillDiscoveryResult } from '../../../../shared/skills'
import { skillAgentByRootPath } from '../skills/skill-agent-filter'
import type { CatalogRow, CatalogRowTarget } from './MarketplaceCatalogRows'
import {
  marketplaceSkillPageFromScan,
  type MarketplaceSkillListing,
  type MarketplaceSkillPageData
} from './MarketplaceSkillPageModel'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** The page kinds a catalog row opens. Each kind has one structure in marketplace-page-structure.ts. */
export type MarketplacePageKind =
  | 'agent'
  | 'integration'
  | 'built-in'
  | 'skill'
  | 'item-app'
  | 'item-detail'

/** Stable codes for why a row has no page. */
export type MarketplaceRowBlockReason =
  | 'no-target'
  | 'no-skill-host'
  | 'ssh-no-skill-scan'
  | 'scan-failed'
  | 'skill-not-on-host'

export const MARKETPLACE_ROW_BLOCK_TEXT: Record<MarketplaceRowBlockReason, string> = {
  'no-target': 'This row has no page',
  'no-skill-host': 'No host to scan skills on',
  'ssh-no-skill-scan': 'SSH hosts cannot list skills yet',
  'scan-failed': 'The skill scan failed',
  'skill-not-on-host': 'The skill is not on this host'
}

export type MarketplaceRowPageResolution =
  | { opens: true; pageKind: MarketplacePageKind }
  | { opens: false; reason: MarketplaceRowBlockReason }

/** The host a row reads: the picked host, or this computer through the focused runtime. */
export type MarketplaceRowPageHost = {
  pickedTarget: MarketplaceVaultHostTarget | null
  focusedRuntime: RuntimeClientTarget | null
}

/** One skill scan of a host; null when the host cannot be scanned at all. */
export type MarketplaceSkillScan = (
  pickedTarget: MarketplaceVaultHostTarget | null,
  focusedRuntime: RuntimeClientTarget | null
) => Promise<SkillDiscoveryResult> | null

/** Either the decision a row takes without a scan, or the scan a skill row waits on. */
export type MarketplaceRowPagePlan =
  | { kind: 'resolved'; resolution: MarketplaceRowPageResolution }
  | { kind: 'skill'; listing: MarketplaceSkillListing; scan: Promise<SkillDiscoveryResult> }

export type MarketplaceSkillPageOutcome =
  | { opens: true; page: MarketplaceSkillPageData }
  | { opens: false; reason: 'skill-not-on-host' }

/** The decision for one row on one host; a skill row waits on its scan before it opens. */
export function planMarketplaceRowPage(
  row: CatalogRow,
  host: MarketplaceRowPageHost,
  scan: MarketplaceSkillScan = discoverSkillsForPickedHost
): MarketplaceRowPagePlan {
  const target = row.target
  if (target === null) {
    return { kind: 'resolved', resolution: { opens: false, reason: 'no-target' } }
  }
  const listing = skillListingOf(target)
  if (listing !== null) {
    return planSkillListingPage(listing, host, scan)
  }
  return { kind: 'resolved', resolution: { opens: true, pageKind: pageKindOf(target) } }
}

/** A skill listing's plan: blocked before any scan when there is no host to read, else its scan. */
export function planSkillListingPage(
  listing: MarketplaceSkillListing,
  host: MarketplaceRowPageHost,
  scan: MarketplaceSkillScan = discoverSkillsForPickedHost
): MarketplaceRowPagePlan {
  const pending = scan(host.pickedTarget, host.focusedRuntime)
  if (pending === null) {
    // Why: the scan answers null only for no host or an SSH host, the one picked host it cannot read.
    const reason = host.pickedTarget === null ? 'no-skill-host' : 'ssh-no-skill-scan'
    return { kind: 'resolved', resolution: { opens: false, reason } }
  }
  return { kind: 'skill', listing, scan: pending }
}

/** The page a skill listing shows once its host answers: its copies, or why the skill is not there. */
export function skillPageOutcome(
  listing: MarketplaceSkillListing,
  result: SkillDiscoveryResult
): MarketplaceSkillPageOutcome {
  const page = marketplaceSkillPageFromScan(listing, result.skills, skillAgentByRootPath(result))
  return page === null ? { opens: false, reason: 'skill-not-on-host' } : { opens: true, page }
}

/** The row's full decision, with its skill scan awaited; the audit reads this one. */
export async function resolveMarketplaceRowPage(
  row: CatalogRow,
  host: MarketplaceRowPageHost,
  scan: MarketplaceSkillScan = discoverSkillsForPickedHost
): Promise<MarketplaceRowPageResolution> {
  const plan = planMarketplaceRowPage(row, host, scan)
  if (plan.kind === 'resolved') {
    return plan.resolution
  }
  try {
    const outcome = skillPageOutcome(plan.listing, await plan.scan)
    return outcome.opens
      ? { opens: true, pageKind: 'skill' }
      : { opens: false, reason: outcome.reason }
  } catch {
    return { opens: false, reason: 'scan-failed' }
  }
}

function skillListingOf(target: CatalogRowTarget): MarketplaceSkillListing | null {
  switch (target.kind) {
    case 'skill':
      return { kind: 'discovered', skill: target.skill }
    case 'custom-skill':
      return { kind: 'custom', item: target.item }
    case 'item':
    case 'agent':
    case 'built-in':
    case 'integration':
      return null
  }
}

function pageKindOf(target: CatalogRowTarget): MarketplacePageKind {
  switch (target.kind) {
    case 'item':
      return target.id === 'git' ? 'item-detail' : 'item-app'
    case 'agent':
      return 'agent'
    case 'integration':
      return 'integration'
    case 'built-in':
      return 'built-in'
    case 'skill':
    case 'custom-skill':
      return 'skill'
  }
}
