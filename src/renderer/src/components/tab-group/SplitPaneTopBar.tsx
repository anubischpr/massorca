import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { SessionBarWindowActions } from '../../app-shell/SessionBarWindowActions'
import { sessionTabTitle } from '../../app-shell/session-bar-title'
import { setSplitTopBarActionsTarget } from '../../app-shell/split-top-bar-slot'
import { findTabGroupById, type SplitTopBarChrome } from '../../app-shell/split-top-bar-chrome'
import { TOP_BAR_SURFACE_CLASS } from '../../app-shell/top-bar-surface'
import { useAppStore } from '../../store'
import type { AppState } from '../../store/types'

/** The name of the tab a pane group shows, whichever workspace owns that tab (a referenced session is the group's sessionRef). */
function selectGroupTabTitle(state: AppState, groupId: string): string {
  const group = findTabGroupById(state, groupId)
  const tabId = group?.sessionRef?.tabId ?? group?.activeTabId
  if (!tabId) {
    return ''
  }
  for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
    const tab = tabs.find((row) => row.id === tabId)
    if (tab) {
      return sessionTabTitle(state, worktreeId, tab)
    }
  }
  return ''
}

/**
 * The top row of a pane that touches the window's top edge in a split: it takes the place of the
 * window session bar over that pane's half. Its own actions portal in by group; the rightmost row
 * also carries the window-level buttons and reserves the window controls.
 */
export function SplitPaneTopBar({
  groupId,
  isFocused,
  leftmost,
  rightmost,
  chrome
}: {
  groupId: string
  isFocused: boolean
  /** The pane touches the left edge of the main area, where the collapsed sidebar header can sit. */
  leftmost: boolean
  /** The pane touches the right edge of the main area, where the window controls sit. */
  rightmost: boolean
  chrome: SplitTopBarChrome
}): React.JSX.Element {
  const title = useAppStore((state) => selectGroupTabTitle(state, groupId))
  const setActionsTarget = useCallback(
    (element: HTMLDivElement | null) => setSplitTopBarActionsTarget(groupId, element),
    [groupId]
  )
  const reserveSidebarHeader = leftmost && chrome.reserveCollapsedSidebarHeader
  return (
    <div
      data-pane-top-bar="true"
      data-pane-top-bar-group={groupId}
      className={cn(
        'relative flex h-11 shrink-0 items-center gap-1 px-4 [-webkit-app-region:drag]',
        TOP_BAR_SURFACE_CLASS
      )}
      style={{
        ...(reserveSidebarHeader
          ? { paddingLeft: 'calc(1rem + var(--collapsed-sidebar-header-width, 0px))' }
          : {}),
        ...(rightmost && chrome.reserveWindowControls
          ? { paddingRight: 'calc(1rem + var(--window-controls-width, 0px))' }
          : {})
      }}
    >
      {reserveSidebarHeader ? (
        // Why: the floating sidebar header sits over this row's left end; this island keeps its clicks.
        <div
          data-sidebar-header-island="true"
          aria-hidden
          className="absolute inset-y-0 left-0 [-webkit-app-region:no-drag]"
          style={{ width: 'var(--collapsed-sidebar-header-width, 0px)' }}
        />
      ) : null}
      <span
        data-pane-top-bar-title=""
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-medium',
          isFocused ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {title}
      </span>
      <div
        ref={setActionsTarget}
        data-pane-top-bar-actions=""
        className={cn(
          'flex items-center gap-1 [-webkit-app-region:no-drag]',
          !isFocused && 'opacity-60'
        )}
      />
      {rightmost ? (
        // Why: window-level buttons act on the window, not on this pane, so a click must not focus the group.
        <div
          className="contents"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
        >
          <SessionBarWindowActions
            worktreeId={chrome.worktreeId}
            collapsePane={chrome.collapsePane}
          />
        </div>
      ) : null}
    </div>
  )
}
