import React, { useMemo } from 'react'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getAgentDotState } from './worktree-card-agent-summary'
import { OneLineSessionRow } from './worktree-card-one-line-session-row'
import {
  isSessionGlyphUrgent,
  selectVisibleSessions,
  sessionStatusGlyph,
  VISIBLE_SESSION_LIMIT,
  worstSessionStatusGlyph,
  type SessionStatusGlyph
} from './worktree-session-status'
import { SIDEBAR_TREE_INDENT } from './worktree-list/rows/indentation'

type SendTarget = {
  status: 'eligible' | 'disabled' | 'sending'
  disabledReason?: string
}

export type OneLineSessionTreeProps = {
  rootAgents: readonly DashboardAgentRowData[]
  childrenByParentPaneKey: ReadonlyMap<string, readonly DashboardAgentRowData[]>
  collapsedLineageParents: ReadonlySet<string>
  unvisitedByPaneKey: Readonly<Record<string, boolean>>
  now: number
  focusedAgentPaneKey: string | null
  dimmed: boolean
  allSessionsShown: boolean
  onToggleAllSessionsShown: () => void
  onToggleLineageParent: (paneKey: string) => void
  onActivate: (tabId: string, paneKey: string) => void
  /** Hibernation-retained rows are completion evidence, so activating them does nothing. */
  onActivateRetained: () => void
  getSendTarget?: (paneKey: string) => SendTarget
  onSendTargetClick?: (paneKey: string) => void
}

// Every glyph in a session's subtree, own first. The visited set guards malformed lineage cycles.
export function collectSubtreeGlyphs(
  agent: DashboardAgentRowData,
  childrenByParentPaneKey: ReadonlyMap<string, readonly DashboardAgentRowData[]>,
  unvisitedByPaneKey: Readonly<Record<string, boolean>>,
  visited = new Set<string>()
): (SessionStatusGlyph | null)[] {
  if (visited.has(agent.paneKey)) {
    return []
  }
  visited.add(agent.paneKey)
  const glyphs = [
    sessionStatusGlyph(getAgentDotState(agent), unvisitedByPaneKey[agent.paneKey] ?? false)
  ]
  for (const child of childrenByParentPaneKey.get(agent.paneKey) ?? []) {
    glyphs.push(
      ...collectSubtreeGlyphs(child, childrenByParentPaneKey, unvisitedByPaneKey, visited)
    )
  }
  return glyphs
}

export function OneLineSessionTree(props: OneLineSessionTreeProps): React.JSX.Element {
  const { rootAgents, childrenByParentPaneKey, unvisitedByPaneKey, allSessionsShown } = props
  const { visible, hiddenCount } = useMemo(() => {
    if (allSessionsShown) {
      return { visible: [...rootAgents], hiddenCount: 0 }
    }
    return selectVisibleSessions(rootAgents, (root) =>
      isSessionGlyphUrgent(
        worstSessionStatusGlyph(
          collectSubtreeGlyphs(root, childrenByParentPaneKey, unvisitedByPaneKey)
        )
      )
    )
  }, [allSessionsShown, childrenByParentPaneKey, rootAgents, unvisitedByPaneKey])
  const canFold = allSessionsShown && rootAgents.length > VISIBLE_SESSION_LIMIT

  const renderBranch = (
    agent: DashboardAgentRowData,
    ancestors: ReadonlySet<string> = new Set()
  ): React.ReactNode => {
    if (ancestors.has(agent.paneKey)) {
      return null
    }
    const children = childrenByParentPaneKey.get(agent.paneKey) ?? []
    const expanded = !props.collapsedLineageParents.has(agent.paneKey)
    const subtreeGlyphs = collectSubtreeGlyphs(agent, childrenByParentPaneKey, unvisitedByPaneKey)
    // Why: a folded parent speaks for the children it hides, so urgent work never disappears.
    const glyph =
      children.length > 0 && !expanded
        ? worstSessionStatusGlyph(subtreeGlyphs)
        : (subtreeGlyphs[0] ?? null)
    const sendTarget = props.getSendTarget?.(agent.paneKey)
    const nextAncestors = new Set(ancestors).add(agent.paneKey)
    return (
      <React.Fragment key={agent.paneKey}>
        <OneLineSessionRow
          agent={agent}
          now={props.now}
          glyph={glyph}
          isUnvisited={unvisitedByPaneKey[agent.paneKey] ?? false}
          isFocusedPane={agent.paneKey === props.focusedAgentPaneKey}
          dimmed={props.dimmed}
          onActivate={agent.rowSource === 'retained' ? props.onActivateRetained : props.onActivate}
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={props.onSendTargetClick}
          childAgentCount={children.length > 0 ? children.length : undefined}
          childAgentsExpanded={expanded}
          onToggleChildAgents={
            children.length > 0 ? () => props.onToggleLineageParent(agent.paneKey) : undefined
          }
        />
        {children.length > 0 && expanded ? (
          <div
            className="worktree-agent-lineage-children"
            // Why: the rule sits under the parent icon's centre; children start one tree step in.
            style={{ marginLeft: 7, paddingLeft: SIDEBAR_TREE_INDENT - 8 }}
          >
            {children.map((child) => renderBranch(child, nextAncestors))}
          </div>
        ) : null}
      </React.Fragment>
    )
  }

  return (
    <>
      {visible.map((root) => renderBranch(root))}
      {hiddenCount > 0 || canFold ? (
        <button
          type="button"
          className={cn(
            'flex h-6 w-full items-center rounded-sm px-1 text-left text-[11px] text-muted-foreground',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring'
          )}
          data-one-line-show-more=""
          onClick={(e) => {
            e.stopPropagation()
            props.onToggleAllSessionsShown()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
            }
          }}
        >
          {hiddenCount > 0
            ? translate(
                'auto.components.sidebar.worktree.card.one.line.sessions.showMore',
                'Show {{hiddenCount}} more',
                { hiddenCount }
              )
            : translate(
                'auto.components.sidebar.worktree.card.one.line.sessions.showLess',
                'Show less'
              )}
        </button>
      ) : null}
    </>
  )
}
