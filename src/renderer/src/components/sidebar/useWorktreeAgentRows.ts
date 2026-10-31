import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { applyAgentRowLineage } from '@/components/dashboard/agent-row-lineage'
import { migrationUnsupportedToAgentStatusEntry } from '@/lib/migration-unsupported-agent-entry'
import { useAppStore } from '@/store'
import {
  EMPTY_LIVE_PTY_IDS,
  EMPTY_PANE_FOREGROUND_AGENTS,
  EMPTY_RUNTIME_PANE_TITLES,
  selectLivePtyIdsForWorktree,
  selectPaneForegroundAgentsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import {
  EMPTY_LIVE_ENTRIES,
  EMPTY_MIGRATION_UNSUPPORTED_ENTRIES,
  EMPTY_RETAINED,
  EMPTY_TERMINAL_LAYOUTS,
  selectLiveAgentStatusEntriesForWorktree,
  selectMigrationUnsupportedEntriesForWorktree,
  selectRuntimeAgentOrchestrationForWorktree,
  selectRetainedAgentEntriesForWorktree,
  selectTerminalLayoutsForWorktree
} from './worktree-agent-row-selectors'
import { EMPTY_WORKTREE_AGENT_ORCHESTRATION } from './worktree-agent-orchestration-index'
import {
  selectCrossWorktreeChildLayouts,
  selectCrossWorktreeChildPtyIds,
  selectCrossWorktreeChildTabs,
  selectCrossWorktreeLiveChildEntries,
  selectCrossWorktreeRetainedChildren,
  selectPlacedAwayPaneKeysForWorktree
} from './worktree-child-placement'
import { EMPTY_TABS } from './WorktreeCardHelpers'
import {
  createWorktreeAgentFreshnessSelector,
  EMPTY_WORKTREE_AGENT_FRESHNESS_SIGNATURE
} from './worktree-agent-freshness-selector'

// Why frozen: shared by every inactive card, and callers only read these rows.
const EMPTY_AGENT_ROWS = Object.freeze([]) as unknown as DashboardAgentRow[]
const EMPTY_PLACED_PANE_KEYS: readonly string[] = Object.freeze([])

export { buildWorktreeAgentRows } from './worktree-agent-rows'
export {
  selectLiveAgentStatusEntriesForWorktree,
  selectMigrationUnsupportedEntriesForWorktree,
  selectRuntimeAgentOrchestrationForWorktree,
  selectRetainedAgentEntriesForWorktree
} from './worktree-agent-row-selectors'

/**
 * Narrow per-worktree agent row hook used by the WorktreeCard inline agents
 * list. Produces live hook-reported agents plus retained "done" snapshots,
 * stale-decayed to 'idle' when the hook stream has gone quiet.
 *
 * Uses indexed per-worktree selectors rather than reusing useDashboardData's
 * cross-worktree aggregate. The index is rebuilt once per relevant immutable
 * store slice and then shared by every visible card, avoiding O(cards × agents)
 * selector work on high-frequency agent status pings.
 */
export function useWorktreeAgentRows(
  worktreeId: string,
  active = true,
  placeAcrossWorktrees = false
): DashboardAgentRow[] {
  const selectAgentFreshness = useMemo(
    () => createWorktreeAgentFreshnessSelector(worktreeId),
    [worktreeId]
  )
  const tabs = useAppStore((s) => (active ? s.tabsByWorktree[worktreeId] : EMPTY_TABS))
  // Why: narrow the subscriptions to only THIS worktree's entries via
  // useShallow. Subscribing to the whole agentStatusByPaneKey map would make
  // every on-screen card re-render on any agent-status update anywhere —
  // O(worktrees²) render amplification. Pre-filtering here means the card
  // only re-renders when something relevant to THIS worktree changes.
  const liveEntries = useAppStore(
    useShallow((s) =>
      active ? selectLiveAgentStatusEntriesForWorktree(s, worktreeId) : EMPTY_LIVE_ENTRIES
    )
  )
  // Why: keep the store selector limited to stable raw records. Converting
  // migration entries creates fresh objects with Date.now(), which breaks
  // useSyncExternalStore's cached-snapshot contract and can blank Electron.
  const migrationUnsupported = useAppStore(
    useShallow((s) =>
      active
        ? selectMigrationUnsupportedEntriesForWorktree(s, worktreeId)
        : EMPTY_MIGRATION_UNSUPPORTED_ENTRIES
    )
  )
  const retained = useAppStore(
    useShallow((s) =>
      active ? selectRetainedAgentEntriesForWorktree(s, worktreeId) : EMPTY_RETAINED
    )
  )
  const runtimePaneTitlesByTabId = useAppStore(
    useShallow((s) =>
      active ? selectRuntimePaneTitlesForWorktree(s, worktreeId) : EMPTY_RUNTIME_PANE_TITLES
    )
  )
  const ptyIdsByTabId = useAppStore(
    useShallow((s) => (active ? selectLivePtyIdsForWorktree(s, worktreeId) : EMPTY_LIVE_PTY_IDS))
  )
  const terminalLayoutsByTabId = useAppStore(
    useShallow((s) =>
      active ? selectTerminalLayoutsForWorktree(s, worktreeId) : EMPTY_TERMINAL_LAYOUTS
    )
  )
  const runtimeAgentOrchestrationByPaneKey = useAppStore(
    useShallow((s) =>
      active
        ? selectRuntimeAgentOrchestrationForWorktree(s, worktreeId)
        : EMPTY_WORKTREE_AGENT_ORCHESTRATION
    )
  )
  const paneForegroundAgentByPaneKey = useAppStore(
    useShallow((s) =>
      active ? selectPaneForegroundAgentsForWorktree(s, worktreeId) : EMPTY_PANE_FOREGROUND_AGENTS
    )
  )
  const agentFreshnessSignature = useAppStore((s) =>
    active ? selectAgentFreshness(s) : EMPTY_WORKTREE_AGENT_FRESHNESS_SIGNATURE
  )
  // Why: a child session another worktree runs is listed under its parent only when this card places across worktrees.
  const placing = active && placeAcrossWorktrees
  const placedAwayPaneKeys = useAppStore(
    useShallow((s) =>
      placing ? selectPlacedAwayPaneKeysForWorktree(s, worktreeId) : EMPTY_PLACED_PANE_KEYS
    )
  )
  const crossWorktreeEntries = useAppStore(
    useShallow((s) =>
      placing ? selectCrossWorktreeLiveChildEntries(s, worktreeId) : EMPTY_LIVE_ENTRIES
    )
  )
  const crossWorktreeRetained = useAppStore(
    useShallow((s) =>
      placing ? selectCrossWorktreeRetainedChildren(s, worktreeId) : EMPTY_RETAINED
    )
  )
  const crossWorktreeTabs = useAppStore(
    useShallow((s) => (placing ? selectCrossWorktreeChildTabs(s, worktreeId) : []))
  )
  const crossWorktreePtyIdsByTabId = useAppStore(
    useShallow((s) => (placing ? selectCrossWorktreeChildPtyIds(s, worktreeId) : {}))
  )
  const crossWorktreeLayoutsByTabId = useAppStore(
    useShallow((s) => (placing ? selectCrossWorktreeChildLayouts(s, worktreeId) : {}))
  )

  return useMemo<DashboardAgentRow[]>(() => {
    if (!active) {
      return EMPTY_AGENT_ROWS
    }
    // Why: Date.now() is read inside the memo so stale-decay recalculates when
    // this worktree's freshness signature changes, even without new PTY data.
    const now = Date.now()
    const entries =
      migrationUnsupported.length > 0
        ? [
            ...liveEntries,
            ...migrationUnsupported.flatMap((unsupported) => {
              const entry = migrationUnsupportedToAgentStatusEntry(unsupported)
              return entry ? [entry] : []
            })
          ]
        : liveEntries
    return applyAgentRowLineage(
      buildWorktreeAgentRows({
        tabs: tabs ?? EMPTY_TABS,
        entries,
        retained,
        runtimePaneTitlesByTabId,
        ptyIdsByTabId,
        terminalLayoutsByTabId,
        runtimeAgentOrchestrationByPaneKey,
        paneForegroundAgentByPaneKey,
        placedElsewherePaneKeys: placedAwayPaneKeys,
        crossWorktreeChildren: placing
          ? {
              entries: crossWorktreeEntries,
              retained: crossWorktreeRetained,
              tabs: crossWorktreeTabs,
              ptyIdsByTabId: crossWorktreePtyIdsByTabId,
              terminalLayoutsByTabId: crossWorktreeLayoutsByTabId
            }
          : undefined,
        now
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    placing,
    tabs,
    liveEntries,
    migrationUnsupported,
    retained,
    runtimePaneTitlesByTabId,
    ptyIdsByTabId,
    terminalLayoutsByTabId,
    runtimeAgentOrchestrationByPaneKey,
    paneForegroundAgentByPaneKey,
    placedAwayPaneKeys,
    crossWorktreeEntries,
    crossWorktreeRetained,
    crossWorktreeTabs,
    crossWorktreePtyIdsByTabId,
    crossWorktreeLayoutsByTabId,
    agentFreshnessSignature
  ])
}
