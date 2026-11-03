import { Minimize2, PanelRight, SquareArrowOutUpRight, X } from 'lucide-react'
import { TOGGLE_TERMINAL_PANE_EXPAND_EVENT } from '@/constants/terminal'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store'
import { isSidePanelGroupId } from '../store/slices/tabs/side-panel-group'
import { selectSidePanelOpen } from '../store/slices/tabs/side-panel-state'
import { closeSessionPane } from '../components/tab-group/session-picker-pane'
import { selectLayoutWorktreeId } from '../store/slices/tabs/pane-session-ref'
import { BarToggle } from './BarToggle'
import type { SplitTopBarCollapsePane } from './split-top-bar-chrome'

/** The window-level buttons at a top bar's right end: collapse pane, close split pane, side panel and right sidebar. */
export function SessionBarWindowActions({
  worktreeId,
  collapsePane
}: {
  worktreeId: string
  collapsePane: SplitTopBarCollapsePane | null
}): React.JSX.Element {
  // Why: with tabs gone, this is the mouse way out of a split; it merges the focused pane into its neighbour.
  const layoutWorktreeId = useAppStore((s) => selectLayoutWorktreeId(s) ?? worktreeId)
  const splitPane = useAppStore((s) => {
    const main = (s.groupsByWorktree[layoutWorktreeId] ?? []).filter(
      (group) => !isSidePanelGroupId(group.id)
    )
    if (main.length < 2) {
      return null
    }
    const focused = main.find((group) => group.id === s.activeGroupIdByWorktree[layoutWorktreeId])
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
    <div
      data-session-bar-window-actions="true"
      className="flex items-center gap-1 [-webkit-app-region:no-drag]"
    >
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
              onClick={() => closeSessionPane(layoutWorktreeId, splitPane)}
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
  )
}
