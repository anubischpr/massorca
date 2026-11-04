import { useCallback } from 'react'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import type { PreflightStatus } from '../../../../preload/api-types'
import type { MarketplaceAppAgent } from '../../../../shared/marketplace-apps'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useMarketplaceCustomItems } from './MarketplaceCatalogCustom'
import { useMarketplaceInstalledSkills } from './MarketplaceCatalogSkills'
import {
  buildCatalogSections,
  ownedRows,
  type CatalogListState,
  type CatalogRow,
  type CatalogSection,
  type CliBadges
} from './MarketplaceCatalogRows'
import type { MarketplaceItemId } from './marketplace-catalog'
import { marketplaceBadgeState, type MarketplaceBadgeState } from './marketplace-status'
import { useMarketplaceAgents } from './use-marketplace-agents'
import { useMarketplacePreflight } from './use-marketplace-preflight'

// Why: the approved Catalog board shows exactly these agents, in this order; Gentle Shell is the Pi entry.
const BOARD_AGENTS: readonly { app: MarketplaceAppAgent; id: TuiAgent; label: string }[] = [
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

/**
 * The catalog the home page and the sidebar both read. Git, GitHub and the agents are checked on this
 * computer, so a picked remote host shows them as not checked rather than this computer's answer.
 */
export function useMarketplaceCatalog({
  hostLabel,
  local,
  apps,
  refreshPreflight
}: {
  hostLabel: string
  local: boolean
  apps: MarketplaceAppsState
  refreshPreflight: boolean
}): MarketplaceCatalog {
  const preflight = useMarketplacePreflight({ refreshOnMount: refreshPreflight })
  const marketplaceAgents = useMarketplaceAgents()
  const skills = useMarketplaceInstalledSkills()
  const custom = useMarketplaceCustomItems()

  const badgeFor = useCallback(
    (id: MarketplaceItemId): MarketplaceBadgeState => {
      if (!local && (id === 'git' || id === 'github')) {
        return 'unknown'
      }
      return marketplaceBadgeState(id, {
        preflight: preflight.preflight,
        preflightChecked: preflight.checked,
        apps
      })
    },
    [apps, local, preflight.checked, preflight.preflight]
  )

  const agentEntries = BOARD_AGENTS.map(({ id, label }) => ({ id, label }))

  const detectedAgents: CatalogListState<TuiAgent> = !local
    ? { kind: 'unavailable' }
    : marketplaceAgents === null
      ? { kind: 'loading' }
      : {
          kind: 'ready',
          items: BOARD_AGENTS.filter((agent) => marketplaceAgents.includes(agent.app)).map(
            (agent) => agent.id
          )
        }

  const skillList: CatalogListState<DiscoveredSkill> =
    !local || skills.status === 'failed'
      ? { kind: 'unavailable' }
      : skills.status === 'loading'
        ? { kind: 'loading' }
        : { kind: 'ready', items: skills.skills }

  const customList: CatalogListState<MarketplaceCustomItemStatus> = !local
    ? { kind: 'unavailable' }
    : custom.items === null
      ? { kind: 'loading' }
      : { kind: 'ready', items: custom.items }

  const cli = cliBadges(preflight.preflight, preflight.checked, local)
  const sections = buildCatalogSections({
    hostLabel,
    badgeFor,
    cli,
    agentEntries,
    detectedAgents,
    skills: skillList,
    custom: customList,
    installingCustomIds: custom.installingIds
  })

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

/** The GitHub CLI and GitLab CLI states this computer's check reports; a remote host is not checked. */
function cliBadges(preflight: PreflightStatus | null, checked: boolean, local: boolean): CliBadges {
  if (!local) {
    return { gh: 'unknown', gitlab: 'unknown' }
  }
  if (!checked) {
    return { gh: 'checking', gitlab: 'checking' }
  }
  if (preflight === null) {
    return { gh: 'unknown', gitlab: 'unknown' }
  }
  return {
    gh: preflight.gh.installed ? 'installed' : 'not-installed',
    gitlab: gitlabBadge(preflight.glab)
  }
}

function gitlabBadge(glab: PreflightStatus['glab']): MarketplaceBadgeState {
  // Why: payloads from before GitLab support omit glab, so its state is unknown rather than missing.
  if (glab === undefined) {
    return 'unknown'
  }
  if (!glab.installed) {
    return 'not-installed'
  }
  return glab.authenticated ? 'signed-in' : 'not-signed-in'
}
