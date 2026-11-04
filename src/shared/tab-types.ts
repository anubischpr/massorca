import type { AiVaultSessionTitle } from './ai-vault-session-title'
import type { AgentType } from './agent-status-types'
import type { ExecutionHostId } from './execution-host'

// ─── Tab Group Layout ───────────────────────────────────────────────
export type TabGroupSplitDirection = 'horizontal' | 'vertical'

export type TabGroupLayoutNode =
  | { type: 'leaf'; groupId: string }
  | {
      type: 'split'
      direction: TabGroupSplitDirection
      first: TabGroupLayoutNode
      second: TabGroupLayoutNode
      /** Flex ratio of the first child (0–1). Defaults to 0.5 if absent. */
      ratio?: number
    }

// ─── Unified Tab ────────────────────────────────────────────────────
export type TabContentType =
  | 'terminal'
  | 'editor'
  | 'diff'
  | 'conflict-review'
  | 'check-details'
  | 'recorded-file'
  | 'agent-session'
  | 'browser'
  | 'simulator'
  /** A chat's checklist shown in the floating workspace; self-backed like a simulator tab. */
  | 'checklist'
  /** A session another workspace owns, shown as a tab of the floating workspace by reference. */
  | 'session-ref'

export type WorkspaceVisibleTabType =
  | 'terminal'
  | 'editor'
  | 'agent-session'
  | 'browser'
  | 'simulator'
export type CtrlTabOrderMode = 'mru' | 'sequential'

// Why: many-to-one — every editor-family kind collapses to 'editor'. Never invert it by equality;
// resolve the concrete tab and project forward instead.
export function toVisibleTabType(contentType: TabContentType): WorkspaceVisibleTabType {
  if (
    contentType === 'agent-session' ||
    contentType === 'browser' ||
    contentType === 'terminal' ||
    contentType === 'simulator'
  ) {
    return contentType
  }
  return 'editor'
}

export type Tab = {
  id: string // UUID for terminals, filePath for editors (preserves current convention)
  entityId: string // ID of the backing content (terminal tab ID, file path, browser workspace ID)
  groupId: string
  worktreeId: string
  /** Owning execution host when the same worktree id is visible from multiple hosts. */
  executionHostId?: ExecutionHostId
  contentType: TabContentType
  label: string // display title (auto-derived from PTY or filename)
  generatedLabel?: string | null
  /** Stable AI Vault conversation name, bound to its provider session identity. */
  aiVaultTitle?: AiVaultSessionTitle | null
  quickCommandLabel?: string | null
  customLabel: string | null
  color: string | null
  sortOrder: number
  createdAt: number
  isPreview?: boolean // preview tabs get replaced by next single-click open
  isPinned?: boolean // pinned tabs survive "close others"
  /** Provider backing a structured agent-session tab. */
  agentSessionAgent?: AgentType
  /** Why: per-tab rendering mode for coding-agent terminals. `'chat'` shows the
   *  native chat view as an overlay while the live terminal stays mounted
   *  underneath; `'terminal'` (the default for legacy/missing) shows the raw
   *  xterm. Optional so sessions persisted before this field hydrate cleanly. */
  viewMode?: 'terminal' | 'chat'
  /** Timestamp when the tab was last focused / activated by the user. */
  lastFocusedAt?: number
  /** The session a 'session-ref' tab shows; the session stays in the workspace named here. */
  sessionRef?: TabGroupSessionRef
}

/**
 * A pane that shows a live session owned by another workspace, by reference: the session keeps its
 * workspace, host and working directory, and this pane holds no tab of its own.
 */
export type TabGroupSessionRef = {
  worktreeId: string
  tabId: string
  /** Set when the floating workspace started the session: closing the tab that shows it ends it. */
  endsSessionOnClose?: true
}

/** Focus on a pane that shows another workspace's session: whose layout shows it, and whose session it is. */
export type PaneSessionFocus = {
  layoutWorktreeId: string
  ownerWorktreeId: string
  groupId: string
}

export type TabGroup = {
  id: string
  worktreeId: string
  activeTabId: string | null
  tabOrder: string[] // canonical visual order of tab IDs
  /** Per-group MRU stack (oldest → most-recent at the tail). Drives which tab
   *  becomes active when the current active tab closes: we pop back to the
   *  previously-active tab instead of jumping to a visual neighbor. Scoped to
   *  the group so split panes keep independent histories. Optional because
   *  sessions persisted before this field was added still hydrate cleanly —
   *  hydration seeds from activeTabId. */
  recentTabIds?: string[]
  /** Optional so older sessions hydrate unchanged, and an older build that ignores it keeps every tab. */
  sessionRef?: TabGroupSessionRef
}
