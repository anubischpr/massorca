import React from 'react'
import { Bell, Columns2, Copy, Pencil, X } from 'lucide-react'

import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { WORKTREE_CONTEXT_MENU_SCOPE_ATTR } from './worktree-context-menu-policy'
import { OneLineSessionWorktreeItems } from './worktree-card-one-line-session-worktree-items'
import {
  canOpenSessionInSplitView,
  openSessionInSplitView,
  type SplitViewSession
} from '../tab-group/session-split-view'

type SessionMenuKind = {
  /** The session owns a tab, so it can be renamed and closed like any tab. */
  ownsTab: boolean
  /** The session has a live pane whose unread mark can be cleared. */
  hasPane: boolean
}

/**
 * Which actions a session kind supports. A subagent child has no pane or tab of its own, a retained
 * row outlives its tab, and a child sharing its parent's tab cannot name or close it alone. A session
 * from another worktree, listed under its parent, takes the subagent child's actions.
 */
export function getSessionMenuKind(agent: DashboardAgentRow): SessionMenuKind {
  const isSubagent = agent.rowSource === 'subagent' || agent.crossWorktree === true
  const isRetained = agent.rowSource === 'retained'
  const sharesParentTab =
    agent.lineage?.depth === 1 &&
    parsePaneKey(agent.entry.orchestration?.parentPaneKey ?? '')?.tabId === agent.tab.id
  return {
    ownsTab: !isSubagent && !isRetained && !sharesParentTab,
    hasPane: !isSubagent
  }
}

function copyText(text: string): void {
  void navigator.clipboard.writeText(text).catch(() => undefined)
}

/** Opens the session beside the focused one; absent for a session already on screen. */
function SessionSplitViewItem({
  session
}: {
  session: SplitViewSession
}): React.JSX.Element | null {
  const available = useAppStore((state) => canOpenSessionInSplitView(state, session))
  if (!available) {
    return null
  }
  return (
    <>
      <ContextMenuItem onSelect={() => openSessionInSplitView(session)}>
        <Columns2 className="size-3.5" />
        {translate('auto.components.sidebar.OneLineSessionMenu.splitView', 'Split view')}
      </ContextMenuItem>
      <ContextMenuSeparator />
    </>
  )
}

export function OneLineSessionMenu({
  agent,
  title,
  onStartRename,
  children
}: {
  agent: DashboardAgentRow
  title: string
  onStartRename: () => void
  children: React.ReactElement
}): React.JSX.Element {
  const kind = getSessionMenuKind(agent)
  const worktreeId = agent.tab.worktreeId
  const renameRequestedRef = React.useRef(false)
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        // Why: a session is its own context menu scope, so the branch menu does not open over it.
        {...{ [WORKTREE_CONTEXT_MENU_SCOPE_ATTR]: 'session' }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-52"
        // Why: the closing menu restores focus, which blurred an editor opened on select and closed it at once.
        onCloseAutoFocus={(event) => {
          if (renameRequestedRef.current) {
            renameRequestedRef.current = false
            event.preventDefault()
            onStartRename()
          }
        }}
      >
        {kind.ownsTab || agent.crossWorktree ? (
          <SessionSplitViewItem session={{ worktreeId, tabId: agent.tab.id }} />
        ) : null}
        {kind.ownsTab ? (
          <ContextMenuItem
            onSelect={() => {
              renameRequestedRef.current = true
            }}
          >
            <Pencil className="size-3.5" />
            {translate('auto.components.tab.bar.EditorFileTabContextMenu.68cc610e7f', 'Rename')}
          </ContextMenuItem>
        ) : null}
        {kind.hasPane ? (
          <ContextMenuItem
            onSelect={() =>
              useAppStore.getState().acknowledgeAgents([agent.paneKey], undefined, 'explicit')
            }
          >
            <Bell className="size-3.5" />
            {translate('auto.components.sidebar.WorktreeContextMenu.8dacff1fe0', 'Mark Read')}
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={() => copyText(title)}>
          <Copy className="size-3.5" />
          {translate('auto.components.sidebar.OneLineSessionMenu.copyTitle', 'Copy Title')}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const path = Object.values(useAppStore.getState().worktreesByRepo)
              .flat()
              .find((entry) => entry.id === worktreeId)?.path
            if (path) {
              copyText(path)
            }
          }}
        >
          <Copy className="size-3.5" />
          {translate('auto.components.sidebar.WorktreeContextMenu.3350101edb', 'Copy Path')}
        </ContextMenuItem>
        {/* Why: a session from another worktree stands in for that worktree's hidden row. */}
        {agent.crossWorktree ? <OneLineSessionWorktreeItems worktreeId={worktreeId} /> : null}
        {kind.ownsTab ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() =>
                // Why: the tab bar's own close path, so the worktree and its other tabs stay.
                // Loaded on use: the command layer pulls in the whole workspace, which a sidebar row does not need to render.
                void import('@/lib/workspace-tab-commands').then(
                  ({ dispatchWorkspaceTabCommand }) =>
                    dispatchWorkspaceTabCommand({
                      type: 'close',
                      target: { kind: 'tab', worktreeId, tabId: agent.tab.id }
                    })
                )
              }
            >
              <X className="size-3.5" />
              {translate('auto.components.tab.bar.SortableTabContextMenu.89359a36f7', 'Close')}
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}
