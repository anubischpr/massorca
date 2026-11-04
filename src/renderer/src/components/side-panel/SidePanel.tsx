import { translate } from '@/i18n/i18n'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useAppStore } from '../../store'
import { selectSidePanelWorktreeId } from '../../store/slices/tabs/pane-session-ref'
import { sidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import {
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  selectSidePanelOpen
} from '../../store/slices/tabs/side-panel-state'
import TabGroupPanel from '../tab-group/TabGroupPanel'
import { SidePanelEmptyState } from './SidePanelEmptyState'
import { SidePanelTabStrip } from './SidePanelTabStrip'
import { useSidePanelModel } from './use-side-panel-model'

/** The workspace's second tab surface, right of the main area. Stays mounted while closed so its panes keep their anchor. */
function SidePanelFor({
  worktreeId,
  isWorktreeActive,
  isTabDragActive
}: {
  worktreeId: string
  isWorktreeActive: boolean
  isTabDragActive: boolean
}): React.JSX.Element | null {
  const panelGroupId = sidePanelGroupId(worktreeId)
  const open = useAppStore((s) => selectSidePanelOpen(s, worktreeId))
  const hasPanelGroup = useAppStore(
    (s) => s.groupsByWorktree[worktreeId]?.some((group) => group.id === panelGroupId) ?? false
  )
  const focused = useAppStore((s) => s.activeGroupIdByWorktree[worktreeId] === panelGroupId)
  const width = useAppStore((s) => s.sidePanelWidth)
  const setWidth = useAppStore((s) => s.setSidePanelWidth)
  const model = useSidePanelModel(worktreeId)
  const { containerRef, onResizeStart } = useSidebarResize<HTMLElement>({
    isOpen: open,
    width,
    minWidth: MIN_SIDE_PANEL_WIDTH,
    maxWidth: MAX_SIDE_PANEL_WIDTH,
    deltaSign: -1,
    setWidth
  })
  if (!open && !hasPanelGroup) {
    return null
  }
  return (
    <aside
      ref={containerRef}
      aria-label={translate('components.side-panel.label', 'Side panel')}
      aria-hidden={!open}
      inert={!open}
      data-side-panel="true"
      data-open={open}
      className="relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar data-[open=true]:border-l data-[open=true]:border-border"
    >
      <SidePanelTabStrip
        groupId={panelGroupId}
        worktreeId={worktreeId}
        items={model.items}
        newTabOptions={model.newTabOptions}
        onActivate={model.activate}
        onClose={model.close}
        onCreate={model.create}
      />
      {model.items.length > 0 ? (
        <TabGroupPanel
          groupId={panelGroupId}
          worktreeId={worktreeId}
          isVisible={isWorktreeActive && open}
          isFocused={focused}
          hasSplitGroups={false}
          touchesLeftEdge
          touchesRightEdge
          touchesBottomEdge
          isTabDragActive={isTabDragActive}
        />
      ) : (
        <SidePanelEmptyState options={model.newTabOptions} onCreate={model.create} />
      )}
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-ring/20 active:bg-ring/30"
        onMouseDown={onResizeStart}
      />
    </aside>
  )
}

/**
 * The panel the layout of `worktreeId` shows: that workspace's own, or, while a pane that shows
 * another workspace's session has focus, the session owner's.
 */
export function SidePanel(props: {
  worktreeId: string
  isWorktreeActive: boolean
  isTabDragActive: boolean
}): React.JSX.Element | null {
  const shownFor = useAppStore((state) => selectSidePanelWorktreeId(state, props.worktreeId))
  return shownFor ? <SidePanelFor {...props} worktreeId={shownFor} /> : null
}
