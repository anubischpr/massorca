import { applyAgentRowLineage } from '@/components/dashboard/agent-row-lineage'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { migrationUnsupportedToAgentStatusEntry } from '@/lib/migration-unsupported-agent-entry'
import type { AppState } from '@/store'
import { EMPTY_TABS } from './WorktreeCardHelpers'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import {
  selectLiveAgentStatusEntriesForWorktree,
  selectMigrationUnsupportedEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree,
  selectRuntimeAgentOrchestrationForWorktree,
  selectTerminalLayoutsForWorktree
} from './worktree-agent-row-selectors'
import {
  selectLivePtyIdsForWorktree,
  selectPaneForegroundAgentsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import {
  selectCrossWorktreeChildLayouts,
  selectCrossWorktreeChildPtyIds,
  selectCrossWorktreeChildTabs,
  selectCrossWorktreeLiveChildEntries,
  selectCrossWorktreeRetainedChildren,
  selectPlacedAwayPaneKeysForWorktree
} from './worktree-child-placement'

/**
 * A worktree's session rows read straight from the store, for a row that has no card mounted (a
 * folded project's hidden worktrees). Takes the same inputs as useWorktreeAgentRows, and places
 * cross-worktree child sessions the same way when `placeAcrossWorktrees` is set.
 */
export function selectWorktreeAgentRowsFromState(
  state: AppState,
  worktreeId: string,
  now: number,
  placeAcrossWorktrees = false
): DashboardAgentRow[] {
  const liveEntries = selectLiveAgentStatusEntriesForWorktree(state, worktreeId)
  const migrationUnsupported = selectMigrationUnsupportedEntriesForWorktree(state, worktreeId)
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
      tabs: state.tabsByWorktree[worktreeId] ?? EMPTY_TABS,
      entries,
      retained: selectRetainedAgentEntriesForWorktree(state, worktreeId),
      runtimePaneTitlesByTabId: selectRuntimePaneTitlesForWorktree(state, worktreeId),
      ptyIdsByTabId: selectLivePtyIdsForWorktree(state, worktreeId),
      terminalLayoutsByTabId: selectTerminalLayoutsForWorktree(state, worktreeId),
      runtimeAgentOrchestrationByPaneKey: selectRuntimeAgentOrchestrationForWorktree(
        state,
        worktreeId
      ),
      paneForegroundAgentByPaneKey: selectPaneForegroundAgentsForWorktree(state, worktreeId),
      ...(placeAcrossWorktrees
        ? {
            placedElsewherePaneKeys: selectPlacedAwayPaneKeysForWorktree(state, worktreeId),
            crossWorktreeChildren: {
              entries: selectCrossWorktreeLiveChildEntries(state, worktreeId),
              retained: selectCrossWorktreeRetainedChildren(state, worktreeId),
              tabs: selectCrossWorktreeChildTabs(state, worktreeId),
              ptyIdsByTabId: selectCrossWorktreeChildPtyIds(state, worktreeId),
              terminalLayoutsByTabId: selectCrossWorktreeChildLayouts(state, worktreeId)
            }
          }
        : {}),
      now
    })
  )
}
