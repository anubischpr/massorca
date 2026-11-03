import React, { useCallback, useState } from 'react'
import { DashboardAgentChildDisclosure } from '@/components/dashboard/DashboardAgentChildDisclosure'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import { useAgentRowConversationName } from '@/components/dashboard/use-agent-row-conversation-name'
import { agentChildRowText } from '@/components/agent-child-row-text'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent, formatAgentRowTypeLabel } from '@/lib/agent-status'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { piRuntimeForSessionFilePath } from '../../../../shared/pi-runtime-selection'
import { getCompactAgentPrimary } from './worktree-card-compact-agent-row'
import { SessionStatusGlyphIcon } from './SessionStatusGlyphIcon'
import { OneLineSessionHover } from './worktree-card-one-line-session-hover'
import { getAgentDotState } from './worktree-card-agent-summary'
import { sessionStatusGlyph } from './worktree-session-status'
import { OneLineSessionMenu } from './worktree-card-one-line-session-menu'
import { CrossWorktreeBranchIcon } from './worktree-card-one-line-cross-worktree-branch'
import { WorktreeTitleInlineRename } from './WorktreeTitleInlineRename'
import type { SessionStatusGlyph } from './worktree-session-status'

export const ONE_LINE_SESSION_ROW_HEIGHT_PX = 26

type OneLineSessionRowProps = {
  agent: DashboardAgentRowData
  now: number
  /** Already folds in the hidden children's worst status when this row's children are collapsed. */
  glyph: SessionStatusGlyph | null
  isUnvisited: boolean
  isFocusedPane: boolean
  /** The host cannot be reached: rows dim and show the unconfirmed state, never an exit. */
  dimmed: boolean
  /** The branch a child session in another worktree runs on; its icon names it. */
  crossWorktreeBranch?: string
  /** A child session in another worktree passes that worktree, so its pane is focused there. */
  onActivate: (tabId: string, paneKey: string, ownerWorktreeId?: string) => void
  // Why: send-target mode turns sidebar rows into the picker surface, as the other row layouts do.
  sendTargetStatus?: 'eligible' | 'disabled' | 'sending'
  sendTargetDisabledReason?: string
  onSendTargetClick?: (paneKey: string) => void
  childAgentCount?: number
  childAgentsExpanded?: boolean
  onToggleChildAgents?: () => void
}

export function getOneLineSessionTitleClassName(args: {
  isUnvisited: boolean
  isFocusedPane: boolean
  glyph: SessionStatusGlyph | null
}): string {
  if (args.isUnvisited) {
    return 'font-semibold text-foreground'
  }
  if (args.isFocusedPane || args.glyph === 'needs-human' || args.glyph === 'failed') {
    return 'text-foreground'
  }
  return 'text-muted-foreground'
}

/** A folded parent's "+N" sits in the chevron's own hit target, so clicking the count unfolds it. */
export function OneLineChildDisclosure({
  count,
  expanded,
  onToggle
}: {
  count: number
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <DashboardAgentChildDisclosure
      childAgentCount={count}
      childAgentsExpanded={expanded}
      onToggleChildAgents={onToggle}
      timestamp={
        expanded ? undefined : (
          <span className="text-[10px] tabular-nums text-muted-foreground/70">+{count}</span>
        )
      }
    />
  )
}

export const OneLineSessionRow = React.memo(function OneLineSessionRow({
  agent,
  now,
  glyph,
  isUnvisited,
  isFocusedPane,
  dimmed,
  crossWorktreeBranch,
  onActivate,
  sendTargetStatus,
  sendTargetDisabledReason,
  onSendTargetClick,
  childAgentCount,
  childAgentsExpanded = false,
  onToggleChildAgents
}: OneLineSessionRowProps) {
  const piRuntime = usePiDisplayRuntime({
    worktreeId: agent.tab.worktreeId,
    enabled: agent.agentType === 'pi'
  })
  const conversationName = useAgentRowConversationName(agent)
  const title = agent.childRow
    ? agentChildRowText(agent.childRow, now).lead
    : getCompactAgentPrimary(agent, conversationName)
  const hasChildDisclosure =
    typeof childAgentCount === 'number' &&
    childAgentCount > 0 &&
    typeof onToggleChildAgents === 'function'
  // Why: a subagent child carries its own name in agentType, which is not an iconable agent.
  const hideIcon = agent.rowSource === 'subagent'
  const shownGlyph = dimmed && glyph !== null ? 'unconfirmed' : glyph
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  // Why three steps: the editor takes a one-shot "begin" request, then reports when it closes.
  const [renameStep, setRenameStep] = useState<'off' | 'requested' | 'editing'>('off')

  const handleActivate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (renameStep !== 'off') {
        return
      }
      // Why: subagent rows have no pane of their own; they focus the pane that spawned them.
      // Why: a session in another worktree focuses its own worktree, not the card that lists it.
      onActivate(
        agent.tab.id,
        agent.activationPaneKey ?? agent.paneKey,
        agent.crossWorktree ? agent.tab.worktreeId : undefined
      )
    },
    [
      agent.activationPaneKey,
      agent.crossWorktree,
      agent.paneKey,
      agent.tab.id,
      agent.tab.worktreeId,
      onActivate,
      renameStep
    ]
  )
  const handleSendTargetClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!sendTargetStatus) {
        return
      }
      if (
        e.target instanceof Element &&
        e.target.closest('button, a, input, textarea, select, [role="button"]')
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (sendTargetStatus === 'eligible') {
        onSendTargetClick?.(agent.paneKey)
      }
    },
    [agent.paneKey, onSendTargetClick, sendTargetStatus]
  )

  const row = (
    <div
      draggable={false}
      className={cn(
        'group/one-line-session flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-1 text-xs leading-none',
        // Why: agent-disclosure-row reveals a folded parent's chevron on hover; without it the chevron stays invisible.
        'worktree-agent-row-hover agent-disclosure-row',
        isFocusedPane && 'bg-worktree-sidebar-accent',
        dimmed && 'opacity-60',
        sendTargetStatus === 'sending' && 'cursor-progress opacity-75',
        sendTargetStatus === 'disabled' && 'cursor-default opacity-60'
      )}
      style={{ height: ONE_LINE_SESSION_ROW_HEIGHT_PX }}
      onClickCapture={handleSendTargetClickCapture}
      onClick={handleActivate}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
      data-one-line-session-row=""
      data-focused-agent-pane={isFocusedPane ? 'true' : undefined}
      data-agent-send-target={sendTargetStatus}
      role={agent.lineage ? 'treeitem' : undefined}
      aria-level={agent.lineage ? agent.lineage.depth + 1 : undefined}
      aria-expanded={hasChildDisclosure ? childAgentsExpanded : undefined}
      title={sendTargetDisabledReason}
    >
      {hideIcon ? null : (
        <span className="inline-flex shrink-0" title={formatAgentRowTypeLabel(agent, piRuntime)}>
          <AgentIcon
            agent={agentTypeToIconAgent(agent.agentType)}
            size={14}
            chatPiRuntime={
              agent.agentType === 'pi' && agent.entry.providerSession?.transcriptPath
                ? piRuntimeForSessionFilePath(agent.entry.providerSession.transcriptPath)
                : undefined
            }
          />
        </span>
      )}
      {crossWorktreeBranch ? <CrossWorktreeBranchIcon branch={crossWorktreeBranch} /> : null}
      {renameStep === 'off' ? (
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            getOneLineSessionTitleClassName({ isUnvisited, isFocusedPane, glyph: shownGlyph })
          )}
          title={sendTargetDisabledReason ? undefined : title}
        >
          {title}
        </span>
      ) : (
        <WorktreeTitleInlineRename
          displayName={title}
          className="text-xs"
          editingClassName="flex-1"
          beginEditing={renameStep === 'requested'}
          onBeginEditingConsumed={() => setRenameStep('editing')}
          onEditingChange={(editing) => {
            if (!editing) {
              setRenameStep('off')
            }
          }}
          onRename={(name) => setTabCustomTitle(agent.tab.id, name)}
        />
      )}
      {hasChildDisclosure ? (
        <OneLineChildDisclosure
          count={childAgentCount}
          expanded={childAgentsExpanded}
          onToggle={onToggleChildAgents}
        />
      ) : null}
      {shownGlyph ? <SessionStatusGlyphIcon glyph={shownGlyph} /> : null}
    </div>
  )
  // Why: the row's own state decides the hover, not the folded children's worst glyph.
  const ownGlyph = sessionStatusGlyph(getAgentDotState(agent), isUnvisited)
  return (
    <OneLineSessionHover
      paneKey={agent.paneKey}
      tabId={agent.tab.id}
      worktreeId={agent.tab.worktreeId}
      ownGlyph={ownGlyph}
      dimmed={dimmed}
      enabled={renameStep === 'off' && !sendTargetStatus}
      crossWorktreeBranch={crossWorktreeBranch}
    >
      <div className="min-w-0" data-one-line-session-hover-trigger="">
        <OneLineSessionMenu
          agent={agent}
          title={title}
          onStartRename={() => setRenameStep('requested')}
        >
          {row}
        </OneLineSessionMenu>
      </div>
    </OneLineSessionHover>
  )
})
