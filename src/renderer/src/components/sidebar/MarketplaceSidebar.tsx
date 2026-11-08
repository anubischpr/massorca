import { Book, Bot, Check, LayoutGrid, Plug, Wrench, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { GentleShellIcon } from '@/lib/agent-icon-gentle-shell'
import { useAppStore } from '@/store'
import type { MarketplaceSection } from '@/store/slices/ui/ui-slice-contract-core'
import { useMarketplaceCatalog } from '../marketplace/MarketplaceCatalogData'
import type {
  CatalogRow,
  CatalogRowIcon,
  MarketplaceCatalogFilter
} from '../marketplace/MarketplaceCatalogRows'
import { MarketplaceItemIcon } from '../marketplace/MarketplaceItemIcon'
import { requestSkillRowOpen } from '../marketplace/marketplace-skill-open-request'
import { SidebarRow } from './BotTeamsSidebarProjectsRow'
import { SidebarSearchRow } from './SidebarSearchRow'

/** The apps the sidebar lists under Your apps; "All of them" opens the whole list. */
const SIDEBAR_APP_LIMIT = 6

const ROW_ICON_CLASS = 'size-4 shrink-0 text-worktree-sidebar-foreground/30'

/** The left sidebar in Marketplace mode: Search, the five sections, then Your apps with its count. */
export function MarketplaceSidebar(): React.JSX.Element {
  useTranslation()
  const section = useAppStore((s) => s.marketplaceSection)
  const setSection = useAppStore((s) => s.setMarketplaceSection)
  const selectedId = useAppStore((s) => s.marketplaceSelectedItemId)
  const selectItem = useAppStore((s) => s.selectMarketplaceItem)
  const apps = useAppStore((s) => s.marketplaceApps)
  // Why: the sidebar always lists this computer; a remote host is picked on the page itself.
  const catalog = useMarketplaceCatalog({
    hostLabel: translate(
      'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
      'This computer'
    ),
    local: true,
    apps,
    refreshPreflight: false
  })

  const showSection = (next: MarketplaceSection): void => {
    setSection(next)
    selectItem(null)
  }

  const openRow = (row: CatalogRow): void => {
    const target = row.target
    if (target?.kind === 'item') {
      selectItem(target.id)
      return
    }
    if (row.section === 'skills' && target !== null) {
      // Why: the Marketplace page scans the skill and opens its own page in the Skills section.
      showSection('skills')
      requestSkillRowOpen(row)
      return
    }
    // Why: an agent opens its section here; its page is opened from the list itself.
    showSection(row.section)
  }

  const sectionRows: readonly {
    section: MarketplaceCatalogFilter
    label: string
    icon: LucideIcon
  }[] = [
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
      icon: Book
    },
    {
      section: 'services',
      label: translate('auto.components.marketplace.MarketplaceSidebar.services', 'Services'),
      icon: Plug
    }
  ]

  const listed = catalog.owned.slice(0, SIDEBAR_APP_LIMIT)

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
            <Icon className={ROW_ICON_CLASS} />
            <span className="flex-1">{label}</span>
          </SidebarRow>
        ))}
      </div>
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.05em] text-worktree-sidebar-foreground/45 uppercase">
          {translate('auto.components.marketplace.MarketplaceSidebar.yourApps', 'Your apps')}
        </p>
        <SidebarRow
          active={selectedId === null && section === 'your-apps'}
          onClick={() => showSection('your-apps')}
        >
          <Check className={ROW_ICON_CLASS} />
          <span className="flex-1">
            {translate('auto.components.marketplace.MarketplaceSidebar.allOfThem', 'All of them')}
          </span>
          <span className="rounded-full bg-worktree-sidebar-foreground/8 px-1.5 text-[11px] text-worktree-sidebar-foreground/55">
            {catalog.owned.length}
          </span>
        </SidebarRow>
        {listed.map((row) => (
          <SidebarRow
            key={row.key}
            active={row.target?.kind === 'item' && selectedId === row.target.id}
            onClick={() => openRow(row)}
          >
            <SidebarRowIcon icon={row.icon} />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
          </SidebarRow>
        ))}
      </div>
    </nav>
  )
}

function SidebarRowIcon({ icon }: { icon: CatalogRowIcon }): React.JSX.Element {
  switch (icon.kind) {
    case 'item':
      return <MarketplaceItemIcon id={icon.id} className={ROW_ICON_CLASS} />
    case 'agent':
      return icon.agent === 'pi' ? (
        <GentleShellIcon size={16} />
      ) : (
        <AgentIcon agent={icon.agent} size={16} />
      )
    case 'skill':
      return <Book className={ROW_ICON_CLASS} aria-hidden />
    case 'custom':
      return icon.itemKind === 'agent' ? (
        <Bot className={ROW_ICON_CLASS} aria-hidden />
      ) : (
        <Wrench className={ROW_ICON_CLASS} aria-hidden />
      )
    case 'glyph':
      return <icon.glyph className={ROW_ICON_CLASS} aria-hidden />
  }
}
