import { Minimize2, PanelRight, SquareArrowOutUpRight, X } from 'lucide-react'
import { TOGGLE_TERMINAL_PANE_EXPAND_EVENT } from '@/constants/terminal'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { resolveUnifiedTabLabel } from '../../../shared/tab-title-resolution'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store'
import { isSidePanelGroupId, selectFocusedSessionTab } from '../store/slices/tabs/side-panel-group'
import { selectSidePanelOpen } from '../store/slices/tabs/side-panel-state'
import { closeSessionPane } from '../components/tab-group/session-picker-pane'
import { BarToggle } from './BarToggle'
import { setSessionBarActionsTarget } from './session-bar-slot'
import { TOP_BAR_SURFACE_CLASS } from './top-bar-surface'

/**
 * The one bar at the top of the workspace: the session's name on the left, its actions
 * (rendered in by the session's pane) and the two panel toggles on the right.
 */
export function SessionBar({
  worktreeId,
  reserveWindowControls,
  reserveCollapsedSidebarHeader = false,
  collapsePane = null
}: {
  worktreeId: string
  /** True when the window-controls overlay sits over this bar's right end. */
  reserveWindowControls: boolean
  /** True when the collapsed left sidebar's floating header sits over this bar's left end. */
  reserveCollapsedSidebarHeader?: boolean
  /** Set while the active pane is expanded: the tab the Collapse pane button returns to its split. */
  collapsePane?: { tabId: string; canExpand: boolean } | null
}): React.JSX.Element {
  const name = useAppStore((s) => {
    const tab = selectFocusedSessionTab(s, worktreeId)
    if (!tab) {
      // Why: with no session to name, the bar names the workspace the main area belongs to.
      return s.allWorktrees().find((worktree) => worktree.id === worktreeId)?.displayName ?? ''
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
  // Why: with tabs gone, this is the mouse way out of a split; it merges the focused pane into its neighbour.
  const splitPane = useAppStore((s) => {
    const main = (s.groupsByWorktree[worktreeId] ?? []).filter(
      (group) => !isSidePanelGroupId(group.id)
    )
    if (main.length < 2) {
      return null
    }
    const focused = main.find((group) => group.id === s.activeGroupIdByWorktree[worktreeId])
    return focused?.id ?? null
  })
  const closePaneLabel = translate(
    'auto.components.tab.group.TabGroupPanel.closePaneColumn',
    'Close split pane'
  )
  const sidePanelOpen = useAppStore((s) => selectSidePanelOpen(s, worktreeId))
  const toggleSidePanel = useAppStore((s) => s.toggleSidePanel)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)
  const rightSidebarShortcut = useShortcutLabel('sidebar.right.toggle')
  const collapseLabel = translate('auto.App.c1cf0b0e4a', 'Collapse pane')
  const sidePanelLabel = translate('components.side-panel.label', 'Side panel')
  const rightSidebarLabel = translate('auto.App.9e0b441a91', 'Toggle right sidebar')
  return (
    <header
      data-session-bar="true"
      className={cn(
        'relative flex h-11 shrink-0 items-center gap-1 px-4 [-webkit-app-region:drag]',
        TOP_BAR_SURFACE_CLASS
      )}
      style={{
        ...(reserveWindowControls
          ? { paddingRight: 'calc(1rem + var(--window-controls-width, 0px))' }
          : {}),
        ...(reserveCollapsedSidebarHeader
          ? { paddingLeft: 'calc(1rem + var(--collapsed-sidebar-header-width, 0px))' }
          : {})
      }}
    >
      {reserveCollapsedSidebarHeader ? (
        // Why: Electron resolves drag regions in DOM order, so this bar (later than the sidebar
        // column) would otherwise re-cover the floating sidebar header and swallow its clicks.
        <div
          data-sidebar-header-island="true"
          aria-hidden
          className="absolute inset-y-0 left-0 [-webkit-app-region:no-drag]"
          style={{ width: 'var(--collapsed-sidebar-header-width, 0px)' }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
      <div
        ref={setSessionBarActionsTarget}
        className="flex items-center gap-1 [-webkit-app-region:no-drag]"
      />
      <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
        {collapsePane ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground [&_svg]:size-4"
                aria-label={collapseLabel}
                disabled={!collapsePane.canExpand}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(TOGGLE_TERMINAL_PANE_EXPAND_EVENT, {
                      detail: { tabId: collapsePane.tabId }
                    })
                  )
                }
              >
                <Minimize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {collapseLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {splitPane ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground [&_svg]:size-4"
                aria-label={closePaneLabel}
                onClick={() => closeSessionPane(worktreeId, splitPane)}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {closePaneLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
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
