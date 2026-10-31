import { memo, useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, GitBranch, GitPullRequest } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ExecutionHostId } from '../../../src/shared/execution-host'
import type { AgentWorkingMode } from '../../../src/shared/agent-status-types'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { triggerMediumImpact } from '../platform/haptics'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { resolveBranchRowLabel } from '../worktree/branch-row-label'
import {
  buildSessionListView,
  worstSessionStatusGlyph,
  worktreeStatusGlyph,
  type SessionStatusGlyph,
  type WorktreeRollupStatus
} from '../worktree/session-status-glyph'
import { SessionStatusMark } from './SessionStatusMark'
import { WorktreeAgentList } from './WorktreeAgentList'
import { WorktreeMetaGlyphs, prStateColor } from './WorktreeMetaGlyphs'

// Minimal row shape needed for rendering — a structural subset of the screen's
// Worktree so this component stays decoupled from the screen's local type.
export type WorktreeListRowItem = {
  workspaceKind?: 'git' | 'folder-workspace'
  worktreeId: string
  hostId?: ExecutionHostId
  /** Present only when the list spans hosts; names the host this row runs on. */
  hostContextLabel?: string
  /** Resolved host for the display label; present when legacy rows omit hostId. */
  hostContextHostId?: ExecutionHostId
  repo: string
  branch: string
  displayName: string
  /** The row name the user set on desktop; the row label when present. */
  manualDisplayName?: string | null
  path?: string
  liveTerminalCount: number
  preview: string
  unread: boolean
  isActive?: boolean
  linkedPR: { number: number; state: string } | null
  linkedIssue?: number | null
  linkedLinearIssue?: string | null
  linkedGitLabMR?: number | null
  linkedGitLabIssue?: number | null
  comment?: string
  lineageDepth?: number
  lineageChildCount?: number
  lineageCollapsed?: boolean
  agents?: RuntimeWorktreeAgentRow[]
  workingMode?: AgentWorkingMode
}

type Props<T extends WorktreeListRowItem> = {
  item: T
  isReadOnly: boolean
  now: number
  status: WorktreeRollupStatus
  /** Names what differs from another row on the same branch: the host, else the project. */
  collisionChip?: string | null
  /** The host is unreachable: the row dims, and its sessions show the unconfirmed mark. */
  hostDisconnected?: boolean
  onPress: (item: T) => void
  onLongPress?: (item: T) => void
  onLongPressSession?: (item: T, agent: RuntimeWorktreeAgentRow) => void
  onToggleLineage?: (item: T) => void
}

const EMPTY_AGENTS: RuntimeWorktreeAgentRow[] = []
const LINEAGE_INDENT_PER_DEPTH = 18

// The branch row's trailing mark. A folded branch speaks for its hidden sessions; a branch with no
// sessions speaks for its worktree. An unreachable host has no current state to show.
function branchRowGlyph(input: {
  hasSessions: boolean
  collapsed: boolean
  collapsedWorst: SessionStatusGlyph | null
  unread: boolean
  disconnected: boolean
  status: WorktreeRollupStatus
  workingMode?: AgentWorkingMode
}): SessionStatusGlyph | null {
  if (input.hasSessions) {
    return input.collapsed
      ? worstSessionStatusGlyph([input.collapsedWorst, input.unread ? 'unread' : null])
      : null
  }
  if (input.disconnected) {
    return null
  }
  return worktreeStatusGlyph(input.status, input.unread, input.workingMode)
}

function RowChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

// One line per branch: the lead icon (or the fold toggle when it has sessions), the label, the PR
// number, the host or project chip, the status mark, and the sessions folded beneath it.
function WorktreeListRowComponent<T extends WorktreeListRowItem>({
  item,
  isReadOnly,
  now,
  status,
  collisionChip,
  hostDisconnected = false,
  onPress,
  onLongPress,
  onLongPressSession,
  onToggleLineage
}: Props<T>) {
  const { label, icon } = resolveBranchRowLabel(item)
  const LeadIcon = icon === 'folder' ? Folder : GitBranch
  const lineageDepth = Math.max(0, item.lineageDepth ?? 0)
  const lineageChildCount = item.lineageChildCount ?? 0
  const agents = item.agents ?? EMPTY_AGENTS
  const hasSessions = agents.length > 0
  const [sessionsCollapsed, setSessionsCollapsed] = useState(false)
  const collapsedWorst = useMemo(
    () =>
      sessionsCollapsed && hasSessions
        ? buildSessionListView({
            agents,
            now,
            unvisited: item.unread,
            disconnected: hostDisconnected,
            allShown: false
          }).worst
        : null,
    [sessionsCollapsed, hasSessions, agents, now, item.unread, hostDisconnected]
  )
  const glyph = branchRowGlyph({
    hasSessions,
    collapsed: sessionsCollapsed,
    collapsedWorst,
    unread: item.unread,
    disconnected: hostDisconnected,
    status,
    workingMode: item.workingMode
  })
  const openWorktree = useCallback(() => onPress(item), [item, onPress])
  const longPressSession = useCallback(
    (agent: RuntimeWorktreeAgentRow) => onLongPressSession?.(item, agent),
    [item, onLongPressSession]
  )

  return (
    <View
      style={[
        styles.worktreeRow,
        lineageDepth > 0 && { paddingLeft: spacing.sm + lineageDepth * LINEAGE_INDENT_PER_DEPTH },
        item.isActive && styles.worktreeRowActive
      ]}
    >
      <View style={[styles.branchLine, hostDisconnected && styles.dimmed]}>
        <Pressable
          style={styles.leadButton}
          disabled={!hasSessions || isReadOnly}
          onPress={() => setSessionsCollapsed((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={
            sessionsCollapsed ? `Show sessions of ${label}` : `Hide sessions of ${label}`
          }
        >
          {hasSessions && sessionsCollapsed ? (
            <ChevronRight size={14} color={colors.textSecondary} />
          ) : (
            <LeadIcon size={14} color={colors.textSecondary} />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.mainTap, pressed && styles.worktreeRowPressed]}
          disabled={isReadOnly}
          onPress={openWorktree}
          onLongPress={
            onLongPress
              ? () => {
                  triggerMediumImpact()
                  onLongPress(item)
                }
              : undefined
          }
          delayLongPress={400}
        >
          <View style={styles.mainLine}>
            <Text
              style={[
                styles.label,
                item.unread && styles.labelUnread,
                isReadOnly && styles.textReadOnly
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {item.linkedPR && (
              <View style={styles.prBadge}>
                <GitPullRequest size={10} color={prStateColor(item.linkedPR.state)} />
                <Text style={[styles.prNumber, { color: prStateColor(item.linkedPR.state) }]}>
                  #{item.linkedPR.number}
                </Text>
              </View>
            )}
            <WorktreeMetaGlyphs
              comment={item.comment}
              linkedLinearIssue={item.linkedLinearIssue}
              linkedGitLabMR={item.linkedGitLabMR}
              linkedIssue={item.linkedIssue}
              linkedGitLabIssue={item.linkedGitLabIssue}
            />
            {collisionChip ? <RowChip text={collisionChip} /> : null}
            {hostDisconnected ? <RowChip text="Disconnected" /> : null}
            <SessionStatusMark glyph={glyph} />
          </View>
        </Pressable>

        {lineageChildCount > 0 && onToggleLineage ? (
          <Pressable
            style={styles.lineageToggle}
            onPress={() => onToggleLineage(item)}
            accessibilityRole="button"
          >
            {item.lineageCollapsed ? (
              <ChevronRight size={12} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={12} color={colors.textSecondary} />
            )}
            <GitBranch size={12} color={colors.textSecondary} />
            <Text style={styles.lineageToggleText}>{lineageChildCount}</Text>
          </Pressable>
        ) : null}

        {item.liveTerminalCount > 0 && (
          <Text style={styles.terminalCount}>{item.liveTerminalCount}</Text>
        )}
      </View>

      {hasSessions && !sessionsCollapsed ? (
        <View style={hostDisconnected && styles.dimmed}>
          <WorktreeAgentList
            agents={agents}
            now={now}
            unvisited={item.unread}
            disconnected={hostDisconnected}
            onOpen={isReadOnly ? undefined : openWorktree}
            onLongPress={isReadOnly ? undefined : longPressSession}
          />
        </View>
      ) : null}
    </View>
  )
}

export const WorktreeListRow = memo(WorktreeListRowComponent) as typeof WorktreeListRowComponent

const styles = StyleSheet.create({
  worktreeRow: {
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    paddingVertical: 2,
    // Reserve the active accent bar width so active/inactive rows align.
    borderLeftWidth: 2,
    borderLeftColor: 'transparent'
  },
  // Highlight the worktree currently focused on the desktop, mirroring the
  // desktop sidebar's selected-card treatment (raised fill + left accent).
  worktreeRowActive: {
    backgroundColor: colors.bgPanel,
    // Neutral grey accent, matching the desktop's active-tab indicator rather
    // than a blue line.
    borderLeftColor: colors.textSecondary
  },
  worktreeRowPressed: {
    backgroundColor: colors.bgRaised
  },
  branchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    gap: spacing.xs
  },
  leadButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mainTap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center'
  },
  mainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0
  },
  label: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: typography.monoFamily,
    color: colors.textPrimary
  },
  labelUnread: {
    fontWeight: '700'
  },
  textReadOnly: {
    opacity: 0.5
  },
  dimmed: {
    opacity: 0.6
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgRaised,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  prNumber: {
    fontSize: 10,
    color: colors.textSecondary
  },
  chip: {
    flexShrink: 1,
    maxWidth: 120,
    backgroundColor: colors.bgRaised,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  chipText: {
    fontSize: 10,
    color: colors.textSecondary
  },
  lineageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.button
  },
  lineageToggleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  terminalCount: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    minWidth: 16,
    textAlign: 'right'
  }
})
