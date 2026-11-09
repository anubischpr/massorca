import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { GitDetail, useGitDetailControls } from './GitDetail'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MarketplaceHostProgramUninstall } from './MarketplaceHostProgramControls'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'
import type { MarketplaceCatalogItem } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import { pickedHostLabel } from './marketplace-picked-host-label'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

/** Git's own detail page; the other catalog items open the standard app page instead. */
export function MarketplaceDetail({
  item,
  badgeState,
  onBack
}: {
  item: MarketplaceCatalogItem
  badgeState: MarketplaceBadgeState
  onBack: () => void
}): React.JSX.Element {
  const host = useMarketplaceAppHost()
  const hostLabel = host.scope?.label ?? null
  const git = useGitDetailControls(hostLabel)
  // Why: only Git has a host program here; any other item keeps the note that MassOrca does not remove it.
  const program = item.id === 'git' ? git.program : null
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-5 py-4')}>
      <MarketplacePageHostRow host={host}>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.marketplace.MarketplaceDetail.back', 'Back')}
        </Button>
      </MarketplacePageHostRow>
      <div className="flex items-start gap-3">
        <MarketplaceItemIcon id={item.id} className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{item.name}</h2>
          <p className="text-sm text-muted-foreground">
            {translate(item.description.key, item.description.fallback)}
          </p>
        </div>
        <MarketplaceStatusBadge state={badgeState} />
      </div>
      <GitDetail state={badgeState} hostLabel={hostLabel} controls={git} />
      <MarketplaceFunctionNote part="banner">
        {translate(
          'auto.components.marketplace.MarketplaceDetail.noBanner',
          '{{name}} has no example prompts.',
          { name: item.name }
        )}
      </MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">
          {translate(
            'auto.components.marketplace.MarketplaceDetail.noConnection',
            '{{name}} needs no account.',
            { name: item.name }
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote
          part="access"
          label={translate(
            'auto.components.marketplace.MarketplaceAppAccess.title',
            'Who can use it'
          )}
        >
          {translate(
            'auto.components.marketplace.MarketplaceDetail.toolAccess',
            'Every agent on {{host}} can run it. Limits per agent are not available for tools yet.',
            { host: pickedHostLabel(host) }
          )}
        </MarketplaceFunctionNote>
        <MarketplaceFunctionNote part="advanced">
          {translate(
            'auto.components.marketplace.MarketplaceDetail.noAdvanced',
            '{{name}} has no options in MassOrca.',
            { name: item.name }
          )}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        {program ? (
          <MarketplaceHostProgramUninstall
            program={program}
            host={
              hostLabel ??
              translate('auto.components.marketplace.GitDetail.thisComputer', 'This computer')
            }
          />
        ) : (
          <MarketplaceFunctionNote part="uninstall">
            {translate(
              'auto.components.marketplace.MarketplaceDetail.noUninstall',
              'MassOrca does not remove {{name}}.',
              { name: item.name }
            )}
          </MarketplaceFunctionNote>
        )}
      </MarketplaceAppSection>
    </div>
  )
}

/** "Marketplace > <item>" above an item page; Marketplace returns to the catalog. */
export function MarketplaceBreadcrumb({
  name,
  onBack
}: {
  name: string
  onBack: () => void
}): React.JSX.Element {
  return (
    <nav
      aria-label={translate(
        'auto.components.marketplace.MarketplaceDetail.breadcrumb',
        'Breadcrumb'
      )}
      className="flex items-center gap-1.5 text-sm"
    >
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        {translate('auto.components.marketplace.MarketplaceDetail.marketplace', 'Marketplace')}
      </button>
      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">{name}</span>
    </nav>
  )
}

/** Icon tile, name, description and status line of an item page, with an optional action. */
export function MarketplaceItemHeader({
  icon,
  name,
  description,
  statusTone,
  status,
  action
}: {
  icon: React.ReactNode
  name: string
  description: string | null
  statusTone: MarketplaceStatusTone
  status: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <header className="flex items-start gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-xl font-semibold">{name}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <p className="mt-0.5 flex items-center gap-1.5 text-xs" data-marketplace-status-line>
          <MarketplaceStatusDot tone={statusTone} />
          <span>{status}</span>
        </p>
      </div>
      {action}
    </header>
  )
}

export type MarketplaceStatusTone = 'ok' | 'bad' | 'pending' | 'warn'

/** The colored dot in front of a status line or badge. */
export function MarketplaceStatusDot({ tone }: { tone: MarketplaceStatusTone }): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className="size-1.5 shrink-0 rounded-full data-[tone=bad]:bg-destructive data-[tone=ok]:bg-status-success data-[tone=pending]:bg-muted-foreground data-[tone=warn]:bg-status-warning"
    />
  )
}

/** Small heading above a card on an item page. */
export function MarketplaceCardLabel({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return <h3 className="mb-1.5 text-sm font-medium">{children}</h3>
}

/** A bordered card of rows separated by hairlines. */
export function MarketplaceCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {children}
    </div>
  )
}

/** One card row: a name with an optional muted line under it, and trailing controls. */
export function MarketplaceCardRow({
  name,
  description,
  mono = false,
  leading,
  children
}: {
  name: React.ReactNode
  description?: React.ReactNode
  mono?: boolean
  leading?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {leading}
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{name}</span>
        {description ? (
          <span
            data-mono={mono}
            className="block truncate text-xs text-muted-foreground data-[mono=true]:font-mono"
          >
            {description}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
