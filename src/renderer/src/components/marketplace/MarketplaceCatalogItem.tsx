import { Book, Bot, Check, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentIcon } from '@/lib/agent-catalog'
import { GentleShellIcon } from '@/lib/agent-icon-gentle-shell'
import { cn } from '@/lib/utils'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import type { CatalogRow, CatalogRowIcon } from './MarketplaceCatalogRows'

/** One catalog cell: the icon tile, the name and one line, with its status or action at the right. */
export function MarketplaceCatalogItem({
  row,
  onOpen,
  onAction
}: {
  row: CatalogRow
  onOpen: (row: CatalogRow) => void
  onAction: (row: CatalogRow) => void
}): React.JSX.Element {
  const body = (
    <>
      <CatalogRowTile icon={row.icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        {row.description ? (
          <span className="block truncate text-xs text-muted-foreground">{row.description}</span>
        ) : null}
      </span>
    </>
  )
  return (
    <div className="flex min-w-0 items-center gap-2">
      {row.target ? (
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 p-2">{body}</div>
      )}
      <CatalogRowAction row={row} onAction={onAction} />
    </div>
  )
}

/** The icon tile shared by the catalog, Your apps and the Add custom preview. */
export function CatalogRowTile({
  icon,
  className
}: {
  icon: CatalogRowIcon
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary text-foreground',
        className
      )}
    >
      <TileGlyph icon={icon} />
    </span>
  )
}

function TileGlyph({ icon }: { icon: CatalogRowIcon }): React.JSX.Element {
  switch (icon.kind) {
    case 'item':
      return <MarketplaceItemIcon id={icon.id} className="size-5 text-foreground" />
    case 'agent':
      // Why: in the Marketplace the Pi entry is always Gentle Shell, which keeps its rose.
      return icon.agent === 'pi' ? (
        <GentleShellIcon size={22} />
      ) : (
        <AgentIcon agent={icon.agent} size={22} />
      )
    case 'skill':
      return <Book className="size-5" aria-hidden />
    case 'custom':
      return icon.itemKind === 'agent' ? (
        <Bot className="size-5" aria-hidden />
      ) : (
        <Wrench className="size-5" aria-hidden />
      )
    case 'glyph':
      return <icon.glyph className="size-5" aria-hidden />
  }
}

function CatalogRowAction({
  row,
  onAction
}: {
  row: CatalogRow
  onAction: (row: CatalogRow) => void
}): React.JSX.Element {
  const { status } = row
  if (status.kind === 'pending') {
    return (
      <Button variant="outline" size="sm" className="shrink-0" disabled>
        {status.label}
      </Button>
    )
  }
  // Why: a done or found row opens its page; an action can also install a custom item in place.
  const actionable = row.target !== null || (status.kind === 'action' && row.customId !== null)
  if (status.kind === 'done') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        disabled={!actionable}
        onClick={() => onAction(row)}
      >
        <Check className="size-3.5 text-status-success" aria-hidden />
        {status.label}
      </Button>
    )
  }
  if (status.kind === 'found') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        disabled={!actionable}
        onClick={() => onAction(row)}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-status-success" />
        {status.label}
      </Button>
    )
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0"
      disabled={!actionable}
      onClick={() => onAction(row)}
    >
      {status.label}
    </Button>
  )
}
