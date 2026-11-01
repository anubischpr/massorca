import { PanelRight, SquareArrowOutUpRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resolveUnifiedTabLabel } from '../../../shared/tab-title-resolution'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store'
import { selectFocusedSessionTab } from '../store/slices/tabs/side-panel-group'
import { selectSidePanelOpen } from '../store/slices/tabs/side-panel-state'
import { setSessionBarActionsTarget } from './session-bar-slot'

function BarToggle({
  label,
  tooltip,
  pressed,
  onClick,
  children
}: {
  label: string
  tooltip: string
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          data-active={pressed}
          className="text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground [&_svg]:size-4"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The one bar at the top of the workspace: the session's name on the left, its actions
 * (rendered in by the session's pane) and the two panel toggles on the right.
 */
export function SessionBar({
  worktreeId,
  reserveWindowControls,
  reserveCollapsedSidebarHeader = false
}: {
  worktreeId: string
  /** True when the window-controls overlay sits over this bar's right end. */
  reserveWindowControls: boolean
  /** True when the collapsed left sidebar's floating header sits over this bar's left end. */
  reserveCollapsedSidebarHeader?: boolean
}): React.JSX.Element {
  const name = useAppStore((s) => {
    const tab = selectFocusedSessionTab(s, worktreeId)
    if (!tab) {
      return ''
    }
    const terminal =
      tab.contentType === 'terminal'
        ? s.tabsByWorktree[worktreeId]?.find((row) => row.id === tab.entityId)
        : undefined
    return resolveUnifiedTabLabel(
      {
        ...tab,
        quickCommandLabel: tab.quickCommandLabel ?? terminal?.quickCommandLabel,
        generatedLabel: tab.generatedLabel ?? terminal?.generatedTitle
      },
      s.settings?.tabAutoGenerateTitle === true,
      tab.label
    )
  })
  const sidePanelOpen = useAppStore((s) => selectSidePanelOpen(s, worktreeId))
  const toggleSidePanel = useAppStore((s) => s.toggleSidePanel)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)
  const rightSidebarShortcut = useShortcutLabel('sidebar.right.toggle')
  const sidePanelLabel = translate('components.side-panel.label', 'Side panel')
  const rightSidebarLabel = translate('auto.App.9e0b441a91', 'Toggle right sidebar')
  return (
    <header
      data-session-bar="true"
      className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-background px-4 [-webkit-app-region:drag]"
      style={{
        ...(reserveWindowControls
          ? { paddingRight: 'calc(1rem + var(--window-controls-width, 0px))' }
          : {}),
        ...(reserveCollapsedSidebarHeader
          ? { paddingLeft: 'calc(1rem + var(--collapsed-sidebar-header-width, 0px))' }
          : {})
      }}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
      <div
        ref={setSessionBarActionsTarget}
        className="flex items-center gap-1 [-webkit-app-region:no-drag]"
      />
      <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
        <BarToggle
          label={sidePanelLabel}
          tooltip={sidePanelLabel}
          pressed={sidePanelOpen}
          onClick={() => toggleSidePanel(worktreeId)}
        >
          <SquareArrowOutUpRight />
        </BarToggle>
        <BarToggle
          label={rightSidebarLabel}
          tooltip={translate('auto.App.c184e056de', 'Toggle right sidebar ({{value0}})', {
            value0: rightSidebarShortcut
          })}
          pressed={rightSidebarOpen}
          onClick={toggleRightSidebar}
        >
          <PanelRight />
        </BarToggle>
      </div>
    </header>
  )
}
