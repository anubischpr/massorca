import { cn } from '@/lib/utils'
import { useAppStore } from '../store'
import { selectFocusedSessionTab } from '../store/slices/tabs/side-panel-group'
import { setSessionBarActionsTarget } from './session-bar-slot'
import { sessionTabTitle } from './session-bar-title'
import { SessionBarWindowActions } from './SessionBarWindowActions'
import { TOP_BAR_SURFACE_CLASS } from './top-bar-surface'
import type { SplitTopBarCollapsePane } from './split-top-bar-chrome'

/**
 * The one bar at the top of a single-pane workspace: the session's name on the left, its actions
 * (rendered in by the session's pane) and the window-level buttons on the right. A split draws
 * each top pane's row instead, so this bar is not mounted there.
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
  collapsePane?: SplitTopBarCollapsePane | null
}): React.JSX.Element {
  const name = useAppStore((s) => {
    const tab = selectFocusedSessionTab(s, worktreeId)
    if (!tab) {
      // Why: with no session to name, the bar names the workspace the main area belongs to.
      return s.allWorktrees().find((worktree) => worktree.id === worktreeId)?.displayName ?? ''
    }
    return sessionTabTitle(s, worktreeId, tab)
  })
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
      <SessionBarWindowActions worktreeId={worktreeId} collapsePane={collapsePane} />
    </header>
  )
}
