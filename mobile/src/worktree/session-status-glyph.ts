import type { AgentWorkingMode } from '../../../src/shared/agent-status-types'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { agentDotState, type AgentDotState } from './agent-row-display'
import { flattenAgentRowLineage } from './agent-row-lineage'

/** What a one-line row shows at its trailing edge. Done-and-seen, idle and a user's Stop show nothing. */
export type SessionStatusGlyph =
  | 'needs-human'
  | 'failed'
  | 'working'
  | 'monitoring'
  | 'unconfirmed'
  | 'unread'

/** The worktree rollup the host sends. It has no failed state; failures come from the session rows. */
export type WorktreeRollupStatus = 'working' | 'active' | 'permission' | 'done' | 'inactive'

// Why this order: a pending question first, then news (failure), then live work, then the rest.
const GLYPH_URGENCY: readonly SessionStatusGlyph[] = [
  'needs-human',
  'failed',
  'working',
  'monitoring',
  'unconfirmed',
  'unread'
]

/** Root sessions shown before "Show N more". */
export const VISIBLE_SESSION_LIMIT = 5

export function sessionStatusGlyph(
  state: AgentDotState,
  isUnvisited: boolean
): SessionStatusGlyph | null {
  switch (state) {
    case 'blocked':
    case 'waiting':
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
    case 'idle':
    case 'interrupted':
      return isUnvisited ? 'unread' : null
  }
}

export function worktreeStatusGlyph(
  status: WorktreeRollupStatus,
  isUnread: boolean,
  workingMode?: AgentWorkingMode
): SessionStatusGlyph | null {
  switch (status) {
    case 'permission':
      return 'needs-human'
    case 'working':
      return workingMode === 'monitoring' ? 'monitoring' : 'working'
    case 'active':
    case 'done':
    case 'inactive':
      return isUnread ? 'unread' : null
  }
}

/** The most urgent glyph in a set, or null when every row is quiet. */
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

/** Needs-human, failed, working, monitoring and unread stay on screen; an unconfirmed mark may fold. */
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

export type SessionRowView = {
  agent: RuntimeWorktreeAgentRow
  depth: number
  glyph: SessionStatusGlyph | null
}

export type SessionListView = {
  /** Rows to draw in order; a root session's children always follow it. */
  rows: SessionRowView[]
  /** Root sessions folded behind "Show N more". */
  hiddenCount: number
  /** Every root session, shown or folded. */
  rootCount: number
  /** The worst glyph across every session, which a collapsed branch shows in place of its rows. */
  worst: SessionStatusGlyph | null
}

type SessionBlock = { rows: SessionRowView[]; worst: SessionStatusGlyph | null }

export function buildSessionListView(input: {
  agents: readonly RuntimeWorktreeAgentRow[]
  now: number
  unvisited: boolean
  /** The host cannot be reached, so no row's state is current: each shows the unconfirmed mark. */
  disconnected: boolean
  allShown: boolean
}): SessionListView {
  const blocks: SessionBlock[] = []
  for (const node of flattenAgentRowLineage(input.agents)) {
    const glyph = input.disconnected
      ? 'unconfirmed'
      : sessionStatusGlyph(agentDotState(node.row, input.now), input.unvisited)
    const row: SessionRowView = { agent: node.row, depth: node.depth, glyph }
    const last = blocks[blocks.length - 1]
    if (last && node.depth > 0) {
      last.rows.push(row)
    } else {
      blocks.push({ rows: [row], worst: null })
    }
  }
  // Why: a root and its subtree fold together, so an urgent child keeps its whole tree on screen.
  for (const block of blocks) {
    block.worst = worstSessionStatusGlyph(block.rows.map((row) => row.glyph))
  }
  const { visible, hiddenCount } = input.allShown
    ? { visible: blocks, hiddenCount: 0 }
    : selectVisibleSessions(blocks, (block) => isSessionGlyphUrgent(block.worst))
  return {
    rows: visible.flatMap((block) => block.rows),
    hiddenCount,
    rootCount: blocks.length,
    worst: worstSessionStatusGlyph(blocks.map((block) => block.worst))
  }
}
