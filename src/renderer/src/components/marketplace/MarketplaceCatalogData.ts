import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import type { PreflightStatus } from '../../../../preload/api-types'
import type { MarketplaceAppAgent } from '../../../../shared/marketplace-apps'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useMarketplaceCustomItems, type MarketplaceCustomItems } from './MarketplaceCatalogCustom'
import {
  useMarketplaceInstalledSkills,
  type MarketplaceInstalledSkills
} from './MarketplaceCatalogSkills'
import {
  buildCatalogSections,
  ownedRows,
  type CatalogAgentEntry,
  type CatalogBadge,
  type CatalogBuildInputs,
  type CatalogCheck,
  type CatalogListState,
  type CatalogRow,
  type CatalogSection,
  type CliBadges
} from './MarketplaceCatalogRows'
import type { MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceIntegrationStates } from './marketplace-integrations'
import { useMarketplaceIntegrationStates } from './marketplace-integration-status'
import { marketplaceBadgeState, type MarketplaceBadgeState } from './marketplace-status'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { useMarketplaceAgents } from './use-marketplace-agents'
import { useMarketplacePreflight, type MarketplacePreflight } from './use-marketplace-preflight'
import {
  useMarketplaceRemoteDetection,
  type RemoteHostReads,
  type RemoteTools
} from './use-marketplace-remote-detection'

type BoardAgent = { app: MarketplaceAppAgent; id: TuiAgent; label: string }

// Why: the approved Catalog board shows exactly these agents, in this order; Gentle Shell is the Pi entry.
const BOARD_AGENTS: readonly BoardAgent[] = [
  { app: 'claude', id: 'claude', label: 'Claude Code' },
  { app: 'codex', id: 'codex', label: 'Codex' },
  { app: 'antigravity', id: 'antigravity', label: 'Antigravity' },
  { app: 'gentle-shell', id: 'pi', label: 'Gentle Shell' }
]

export type MarketplaceCatalog = {
  sections: readonly CatalogSection[]
  /** Installed, found or connected rows in section order: what the sidebar lists. */
  owned: readonly CatalogRow[]
  /** Owned rows that are programs, agents or skills. */
  installed: readonly CatalogRow[]
  /** Owned rows that are connected accounts. */
  connected: readonly CatalogRow[]
  badgeFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  installCustom: (id: string) => Promise<void>
}

/** The reads one host's catalog is built from: the page's hooks, or the audit's direct reads. */
export type CatalogHostReads = {
  local: boolean
  hostLabel: string
  apps: MarketplaceAppsState
  preflight: MarketplacePreflight
  marketplaceAgents: readonly MarketplaceAppAgent[] | null
  skills: MarketplaceInstalledSkills
  custom: Pick<MarketplaceCustomItems, 'items' | 'installingIds'>
  remote: RemoteHostReads
  integrations: MarketplaceIntegrationStates
}

/** The rows' build inputs and badge reader for one host; the page and the audit build rows from it. */
export function catalogBuildInputsFor(reads: CatalogHostReads): {
  inputs: CatalogBuildInputs
  badgeFor: (id: MarketplaceItemId) => MarketplaceBadgeState
} {
  const rowBadgeFor = (id: MarketplaceItemId): CatalogBadge =>
    reads.local
      ? marketplaceBadgeState(id, {
          preflight: reads.preflight.preflight,
          preflightChecked: reads.preflight.checked,
          apps: reads.apps
        })
      : remoteBadgeFor(id, reads.remote)
  const agents: CatalogAgentEntry[] = BOARD_AGENTS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    check: reads.local
      ? localAgentCheck(entry.app, reads.marketplaceAgents)
      : remoteAgentCheck(entry, reads.remote)
  }))
  const customList: CatalogListState<MarketplaceCustomItemStatus> = !reads.local
    ? { kind: 'unavailable' }
    : reads.custom.items === null
      ? { kind: 'loading' }
      : { kind: 'ready', items: reads.custom.items }
  return {
    inputs: {
      hostLabel: reads.hostLabel,
      badgeFor: rowBadgeFor,
      cli: reads.local
        ? cliBadges(reads.preflight.preflight, reads.preflight.checked)
        : remoteCliBadges(reads.remote),
      integrations: reads.integrations,
      agents,
      skills: reads.local ? localSkillsCheck(reads.skills) : reads.remote.skills,
      custom: customList,
      installingCustomIds: reads.custom.installingIds
    },
    // Why: the item page's badge has no update state, so a host too old for the check reads as not checked.
    badgeFor: (id) => {
      const badge = rowBadgeFor(id)
      return badge === 'update-required' ? 'unknown' : badge
    }
  }
}

/**
 * The catalog the home page and the sidebar both read. This computer is read locally; a picked host is read
 * through its own calls, and each row shows what that host found, is still checking, or could not check.
 */
export function useMarketplaceCatalog({
  hostLabel,
  local,
  remoteTarget = null,
  apps,
  refreshPreflight
}: {
  hostLabel: string
  local: boolean
  /** The host the page picked when it is not this computer; without it a remote catalog reads as could not check. */
  remoteTarget?: MarketplaceVaultHostTarget | null
  apps: MarketplaceAppsState
  refreshPreflight: boolean
}): MarketplaceCatalog {
  const preflight = useMarketplacePreflight({
    refreshOnMount: refreshPreflight
  })
  const marketplaceAgents = useMarketplaceAgents()
  const skills = useMarketplaceInstalledSkills()
  const custom = useMarketplaceCustomItems()
  const remote = useMarketplaceRemoteDetection(local ? null : remoteTarget)
  const integrations = useMarketplaceIntegrationStates()

  const { inputs, badgeFor } = catalogBuildInputsFor({
    hostLabel,
    local,
    apps,
    preflight,
    marketplaceAgents,
    skills,
    custom,
    remote,
    integrations
  })
  const sections = buildCatalogSections(inputs)
  const owned = ownedRows(sections)
  return {
    sections,
    owned,
    installed: owned.filter((row) => !row.service),
    connected: owned.filter((row) => row.service),
    badgeFor,
    installCustom: custom.install
  }
}

/** A board agent on this computer: still loading until the agent list is read, then found or not. */
function localAgentCheck(
  app: MarketplaceAppAgent,
  detected: readonly MarketplaceAppAgent[] | null
): CatalogCheck<boolean> {
  return detected === null ? { kind: 'loading' } : { kind: 'ready', value: detected.includes(app) }
}

function localSkillsCheck(
  skills: MarketplaceInstalledSkills
): CatalogCheck<readonly DiscoveredSkill[]> {
  switch (skills.status) {
    case 'loading':
      return { kind: 'loading' }
    case 'failed':
      return { kind: 'failed' }
    case 'ready':
      return { kind: 'ready', value: skills.skills }
  }
}

/** A board agent on a picked host. Gentle Shell is a Pi runtime there, so only its runtime report shows it. */
function remoteAgentCheck(entry: BoardAgent, remote: RemoteHostReads): CatalogCheck<boolean> {
  if (entry.app === 'gentle-shell') {
    return mapCheck(remote.piRuntimes, (runtimes) => runtimes.includes('gentle-shell'))
  }
  return mapCheck(remote.agents, (ids) => ids.has(entry.id))
}

function mapCheck<T, U>(check: CatalogCheck<T>, map: (value: T) => U): CatalogCheck<U> {
  return check.kind === 'ready' ? { kind: 'ready', value: map(check.value) } : check
}

/** A host check's state as a row badge. */
function badgeFromCheck<T>(
  check: CatalogCheck<T>,
  badge: (value: T) => MarketplaceBadgeState
): CatalogBadge {
  switch (check.kind) {
    case 'loading':
      return 'checking'
    case 'failed':
      return 'unknown'
    case 'update-required':
      return 'update-required'
    case 'ready':
      return badge(check.value)
  }
}

/** Git, GitHub, Engram and OpenMetadata on a picked host, read from its own answers. */
function remoteBadgeFor(id: MarketplaceItemId, remote: RemoteHostReads): CatalogBadge {
  switch (id) {
    case 'git':
      return badgeFromCheck(remote.tools, (tools) => (tools.git ? 'installed' : 'not-installed'))
    case 'github':
      return badgeFromCheck(remote.tools, (tools) => githubBadge(tools.gh))
    case 'engram':
    case 'openmetadata':
      return badgeFromCheck(remote.apps, (apps) =>
        apps.some((app) => app.id === id && app.connected) ? 'connected' : 'not-connected'
      )
  }
}

function githubBadge(gh: RemoteTools['gh']): MarketplaceBadgeState {
  if (!gh.installed) {
    return 'not-installed'
  }
  return gh.authenticated ? 'signed-in' : 'not-signed-in'
}

/** The GitHub CLI state a picked host reports. */
function remoteCliBadges(remote: RemoteHostReads): CliBadges {
  return {
    gh: badgeFromCheck(remote.tools, (tools) =>
      tools.gh.installed ? 'installed' : 'not-installed'
    )
  }
}

/** The GitHub CLI state this computer's check reports. */
function cliBadges(preflight: PreflightStatus | null, checked: boolean): CliBadges {
  if (!checked) {
    return { gh: 'checking' }
  }
  if (preflight === null) {
    return { gh: 'unknown' }
  }
  return { gh: preflight.gh.installed ? 'installed' : 'not-installed' }
}
