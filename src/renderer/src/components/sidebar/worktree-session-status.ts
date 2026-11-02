import type { AgentDotState } from '@/components/AgentStateDot'
import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { unvisitedByPaneKeyFor } from './worktree-card-agent-ack-inputs'
import { getAgentDotState } from './worktree-card-agent-summary'

/** What a one-line row shows at its right edge. Done-and-seen, idle and a user's Stop show nothing. */
export type SessionStatusGlyph =
  | 'needs-human'
  | 'failed'
  | 'working'
  | 'monitoring'
  | 'unconfirmed'
  | 'unread'

// Why this order: a pending question first, then news (failure), then live work, then the rest.
const GLYPH_URGENCY: readonly SessionStatusGlyph[] = [
  'needs-human',
  'failed',
  'working',
  'monitoring',
  'unconfirmed',
  'unread'
]

export const VISIBLE_SESSION_LIMIT = 5

export function sessionStatusGlyph(
  state: AgentDotState,
  isUnvisited: boolean
): SessionStatusGlyph | null {
  switch (state) {
    case 'waiting':
    case 'blocked':
    case 'permission':
      return 'needs-human'
    case 'failed':
      return 'failed'
    case 'working':
      return 'working'
    case 'monitoring':
      return 'monitoring'
    case 'unconfirmed':
    case 'unverifiable':
      return 'unconfirmed'
    case 'done':
    case 'idle':
    case 'interrupted':
      return isUnvisited ? 'unread' : null
  }
}

/** The worktree-level status (the same one the old card dot used) as a row glyph. */
export function worktreeStatusGlyph(
  status: WorktreeStatus,
  isUnread: boolean
): SessionStatusGlyph | null {
  switch (status) {
    case 'permission':
      return 'needs-human'
    case 'failed':
      return 'failed'
    case 'working':
      return 'working'
    case 'monitoring':
      return 'monitoring'
    case 'unconfirmed':
      return 'unconfirmed'
    case 'done':
    case 'active':
    case 'inactive':
    case 'interrupted':
      return isUnread ? 'unread' : null
  }
}

export function worstSessionStatusGlyph(
  glyphs: Iterable<SessionStatusGlyph | null>
): SessionStatusGlyph | null {
  let worst: SessionStatusGlyph | null = null
  let worstRank = GLYPH_URGENCY.length
  for (const glyph of glyphs) {
    const rank = glyph ? GLYPH_URGENCY.indexOf(glyph) : GLYPH_URGENCY.length
    if (rank < worstRank) {
      worst = glyph
      worstRank = rank
    }
  }
  return worst
}

/** Needs-human, failed, working and unread sessions must stay on screen. */
export function isSessionGlyphUrgent(glyph: SessionStatusGlyph | null): boolean {
  return glyph !== null && glyph !== 'unconfirmed'
}

/**
 * Splits root sessions into the rows shown and the count folded behind "Show N more". Urgent rows
 * always show, even past the limit; the rest fill the remaining slots in their original order.
 */
export function selectVisibleSessions<T>(
  rows: readonly T[],
  isUrgent: (row: T) => boolean,
  limit: number = VISIBLE_SESSION_LIMIT
): { visible: T[]; hiddenCount: number } {
  const urgent = rows.map(isUrgent)
  let freeSlots = Math.max(0, limit - urgent.filter(Boolean).length)
  const visible: T[] = []
  rows.forEach((row, index) => {
    if (urgent[index]) {
      visible.push(row)
    } else if (freeSlots > 0) {
      freeSlots -= 1
      visible.push(row)
    }
  })
  return { visible, hiddenCount: rows.length - visible.length }
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

/** The worst glyph across a worktree's session trees, nested sessions included. */
export function worstSessionTreeGlyph(
  rootAgents: readonly DashboardAgentRowData[],
  childrenByParentPaneKey: ReadonlyMap<string, readonly DashboardAgentRowData[]>,
  unvisitedByPaneKey: Readonly<Record<string, boolean>>
): SessionStatusGlyph | null {
  return worstSessionStatusGlyph(
    rootAgents.flatMap((root) =>
      collectSubtreeGlyphs(root, childrenByParentPaneKey, unvisitedByPaneKey)
    )
  )
}

/** One worktree's inputs for its row glyph: its session rows, or its worktree status when it has none. */
export type WorktreeGlyphInput = {
  agents: readonly DashboardAgentRowData[]
  acknowledgedAgentTimes: readonly number[]
  status: WorktreeStatus | undefined
  isUnread: boolean
}

/**
 * A worktree's glyph where no card shows its sessions. The worst of its session rows speaks for
 * it, so a retained failure beats live work and an unseen session stays unread after activation.
 * The worktree's own unread mark still counts: a background bell sets it with no session to show.
 */
export function worktreeRowGlyph(input: WorktreeGlyphInput): SessionStatusGlyph | null {
  if (input.agents.length === 0) {
    return input.status ? worktreeStatusGlyph(input.status, input.isUnread) : null
  }
  const { rootRows, childrenByParentPaneKey } = buildAgentRowLineageTree(input.agents)
  return worstSessionStatusGlyph([
    worstSessionTreeGlyph(
      rootRows,
      childrenByParentPaneKey,
      unvisitedByPaneKeyFor(input.agents, input.acknowledgedAgentTimes)
    ),
    input.isUnread ? 'unread' : null
  ])
}
