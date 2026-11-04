import { useCallback } from 'react'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { getAgentCatalog, getAgentDisplayLabel } from '@/lib/agent-catalog'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
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
  type CatalogSection
} from './MarketplaceCatalogRows'
import type { MarketplaceItemId } from './marketplace-catalog'
import { marketplaceBadgeState, type MarketplaceBadgeState } from './marketplace-status'
import { useMarketplacePreflight } from './use-marketplace-preflight'

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
  const { detectedIds } = useDetectedAgents(null)
  const piRuntime = usePiDisplayRuntime()
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

  const agentEntries = getAgentCatalog().map((entry) => ({
    id: entry.id,
    label: getAgentDisplayLabel(entry.id, piRuntime)
  }))

  const detectedAgents: CatalogListState<TuiAgent> = !local
    ? { kind: 'unavailable' }
    : detectedIds === null
      ? { kind: 'loading' }
      : { kind: 'ready', items: detectedIds }

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

  const sections = buildCatalogSections({
    hostLabel,
    badgeFor,
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
