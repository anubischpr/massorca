import type { TabGroupLayoutNode } from '../../../../shared/tab-types'
import { SidePanel } from '../side-panel/SidePanel'
import { MainSessionEmptyState } from './MainSessionEmptyState'
import { TabGroupSplitNodeTree } from './TabGroupSplitNodeTree'
import { WorkspaceTabDragLayer } from './WorkspaceTabDragLayer'

/** The main workspace surface: the shared drag scope, the session group tree and the workspace's
 *  side panel beside it. Hosts with their own chrome compose the tree directly. */
export default function TabGroupSplitLayout({
  layout,
  worktreeId,
  focusedGroupId,
  isWorktreeActive
}: {
  layout: TabGroupLayoutNode
  worktreeId: string
  focusedGroupId?: string
  isWorktreeActive: boolean
}): React.JSX.Element {
  return (
    <WorkspaceTabDragLayer worktreeId={worktreeId} enabled={isWorktreeActive}>
      {({ isTabDragActive, setDragRootNode }) => (
        /* Why `border-l` on the wrapper: paint the single full-height divider between the left
          sidebar and the session area, regardless of split state. */
        <div
          ref={setDragRootNode}
          className="flex flex-1 min-w-0 min-h-0 overflow-hidden border-l border-border"
        >
          <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden">
            <TabGroupSplitNodeTree
              layout={layout}
              worktreeId={worktreeId}
              focusedGroupId={focusedGroupId}
              isWorktreeActive={isWorktreeActive}
              isTabDragActive={isTabDragActive}
            />
            {isWorktreeActive ? <MainSessionEmptyState worktreeId={worktreeId} /> : null}
          </div>
          <SidePanel
            worktreeId={worktreeId}
            isWorktreeActive={isWorktreeActive}
            isTabDragActive={isTabDragActive}
          />
        </div>
      )}
    </WorkspaceTabDragLayer>
  )
}
