import { BookOpen, Bot, Cloud, LayoutGrid, Wrench, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type {
  MarketplaceAppsState,
  MarketplaceItemId,
  MarketplaceSection
} from '@/store/slices/ui/ui-slice-contract-core'
import type { MarketplaceAppAgent } from '../../../../shared/marketplace-apps'
import { MarketplaceAgentMark } from '../marketplace/marketplace-agent-mark'
import { marketplaceAgentLabel } from '../marketplace/marketplace-catalog'
import { appStatusFor } from '../marketplace/marketplace-status'
import { MarketplaceItemIcon } from '../marketplace/MarketplaceItemIcon'
import { useMarketplaceAgents } from '../marketplace/use-marketplace-agents'
import { useMarketplacePreflight } from '../marketplace/use-marketplace-preflight'
import type { MarketplacePreflight } from '../marketplace/use-marketplace-preflight'
import { SidebarRow } from './BotTeamsSidebarProjectsRow'
import { SidebarSearchRow } from './SidebarSearchRow'

type InstalledRow = {
  key: string
  label: string
  icon: React.ReactNode
  /** The catalog item this row opens; null for an agent row, which opens the Agents section. */
  itemId: MarketplaceItemId | null
  open: () => void
}

/** The left sidebar in Marketplace mode: Search, the five sections, then the apps on this computer. */
export function MarketplaceSidebar(): React.JSX.Element {
  useTranslation()
  const section = useAppStore((s) => s.marketplaceSection)
  const setSection = useAppStore((s) => s.setMarketplaceSection)
  const selectedId = useAppStore((s) => s.marketplaceSelectedItemId)
  const selectItem = useAppStore((s) => s.selectMarketplaceItem)
  const apps = useAppStore((s) => s.marketplaceApps)
  const preflight = useMarketplacePreflight({ refreshOnMount: false })
  const agents = useMarketplaceAgents()

  const showSection = (next: MarketplaceSection): void => {
    setSection(next)
    selectItem(null)
  }
  const rows = installedRows({
    apps,
    preflight,
    agents,
    selectItem,
    showAgents: () => showSection('agents')
  })

  const sectionRows: readonly { section: MarketplaceSection; label: string; icon: LucideIcon }[] = [
    {
      section: 'all',
      label: translate('auto.components.marketplace.MarketplaceSidebar.all', 'All'),
      icon: LayoutGrid
    },
    {
      section: 'tools',
      label: translate('auto.components.marketplace.MarketplaceSidebar.tools', 'Tools'),
      icon: Wrench
    },
    {
      section: 'agents',
      label: translate('auto.components.marketplace.MarketplaceSidebar.agents', 'Agents'),
      icon: Bot
    },
    {
      section: 'skills',
      label: translate('auto.components.marketplace.MarketplaceSidebar.skills', 'Skills'),
      icon: BookOpen
    },
    {
      section: 'services',
      label: translate('auto.components.marketplace.MarketplaceSidebar.services', 'Services'),
      icon: Cloud
    }
  ]

  return (
    <nav
      aria-label={translate('auto.components.marketplace.MarketplaceSidebar.aria', 'Marketplace')}
      data-marketplace-sidebar="true"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <SidebarSearchRow />
        {sectionRows.map(({ section: id, label, icon: Icon }) => (
          <SidebarRow
            key={id}
            active={selectedId === null && section === id}
            onClick={() => showSection(id)}
          >
            <Icon className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
            <span className="flex-1">{label}</span>
          </SidebarRow>
        ))}
      </div>
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-worktree-sidebar-foreground/45">
          {translate('auto.components.marketplace.MarketplaceSidebar.yourApps', 'Your apps')}
        </p>
        <SidebarRow onClick={() => showSection('all')}>
          <span className="flex-1">
            {translate('auto.components.marketplace.MarketplaceSidebar.allOfThem', 'All of them')}
          </span>
          <span className="rounded-full bg-worktree-sidebar-foreground/8 px-1.5 text-[11px] text-worktree-sidebar-foreground/55">
            {rows.length}
          </span>
        </SidebarRow>
        {rows.map((row) => (
          <SidebarRow
            key={row.key}
            active={row.itemId !== null && selectedId === row.itemId}
            onClick={row.open}
          >
            {row.icon}
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
          </SidebarRow>
        ))}
      </div>
    </nav>
  )
}

/** Git and GitHub from the preflight, agents detected here, then the connected apps. */
function installedRows({
  apps,
  preflight,
  agents,
  selectItem,
  showAgents
}: {
  apps: MarketplaceAppsState
  preflight: MarketplacePreflight
  agents: readonly MarketplaceAppAgent[] | null
  selectItem: (id: MarketplaceItemId) => void
  showAgents: () => void
}): InstalledRow[] {
  const rows: InstalledRow[] = []
  const appRow = (id: MarketplaceItemId, label: string): InstalledRow => ({
    key: id,
    label,
    icon: (
      <MarketplaceItemIcon
        id={id}
        className="size-4 shrink-0 text-worktree-sidebar-foreground/30"
      />
    ),
    itemId: id,
    open: () => selectItem(id)
  })
  if (preflight.preflight?.git.installed) {
    rows.push(appRow('git', 'Git'))
  }
  if (preflight.preflight?.gh.installed || appStatusFor(apps, 'github')?.connected) {
    rows.push(appRow('github', 'GitHub'))
  }
  for (const agent of agents ?? []) {
    rows.push({
      key: `agent-${agent}`,
      label: marketplaceAgentLabel(agent),
      icon: <MarketplaceAgentMark agent={agent} size={16} />,
      itemId: null,
      open: showAgents
    })
  }
  if (appStatusFor(apps, 'engram')?.connected) {
    rows.push(appRow('engram', 'Engram'))
  }
  if (appStatusFor(apps, 'openmetadata')?.connected) {
    rows.push(appRow('openmetadata', 'OpenMetadata'))
  }
  return rows
}
