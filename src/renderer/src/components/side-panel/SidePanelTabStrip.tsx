import { Globe, FileText, Smartphone, Terminal, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidePanelNewTabMenu } from './SidePanelNewTabMenu'
import type { SidePanelNewTabKind, SidePanelNewTabOption } from './side-panel-new-tab-options'
import type { SidePanelTabItem, SidePanelTabKind } from './use-side-panel-model'

function TabKindIcon({ kind }: { kind: SidePanelTabKind }): React.JSX.Element {
  if (kind === 'terminal') {
    return <Terminal className="size-3.5" />
  }
  if (kind === 'browser') {
    return <Globe className="size-3.5" />
  }
  return kind === 'simulator' ? (
    <Smartphone className="size-3.5" />
  ) : (
    <FileText className="size-3.5" />
  )
}

export function SidePanelTabStrip({
  groupId,
  worktreeId,
  items,
  newTabOptions,
  onActivate,
  onClose,
  onCreate,
  onClosePanel
}: {
  groupId: string
  worktreeId: string
  items: readonly SidePanelTabItem[]
  newTabOptions: readonly SidePanelNewTabOption[]
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCreate: (kind: SidePanelNewTabKind) => void
  onClosePanel: () => void
}): React.JSX.Element {
  const closeTabLabel = translate('auto.components.tab.bar.SortableTab.95db5f2f7d', 'Close tab')
  const closePanelLabel = translate('components.side-panel.close', 'Close panel')
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border px-1"
      data-terminal-focus-release-surface="true"
      data-tab-group-strip-id={groupId}
      data-worktree-id={worktreeId}
    >
      <div role="tablist" className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {items.map((item) => (
          <div
            key={item.id}
            data-testid="side-panel-tab"
            data-tab-id={item.visibleId}
            data-tab-title={item.label}
            data-active={item.active}
            className="flex h-7 shrink-0 items-center rounded-md text-xs text-muted-foreground hover:bg-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground"
          >
            <button
              type="button"
              role="tab"
              aria-selected={item.active}
              className="flex h-full items-center gap-1.5 rounded-md pl-2 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => onActivate(item.id)}
            >
              <TabKindIcon kind={item.kind} />
              <span className="max-w-32 truncate">{item.label}</span>
            </button>
            <button
              type="button"
              aria-label={closeTabLabel}
              title={closeTabLabel}
              className="mr-1 flex size-4 items-center justify-center rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => onClose(item.id)}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <SidePanelNewTabMenu options={newTabOptions} onCreate={onCreate} />
      <span className="min-w-0 flex-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={closePanelLabel}
            onClick={onClosePanel}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {closePanelLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
