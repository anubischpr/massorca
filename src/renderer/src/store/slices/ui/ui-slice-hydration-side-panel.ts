import type { PersistedUIState } from '../../../../../shared/persisted-ui-state-types'
import {
  DEFAULT_SIDE_PANEL_WIDTH,
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH
} from '../tabs/side-panel-state'

/** Restores the side panel's width and per-workspace open choices from a saved profile. */
export function hydrateSidePanelState(
  ui: Pick<PersistedUIState, 'sidePanelWidth' | 'sidePanelOpenByWorktree'>
): { sidePanelWidth: number; sidePanelOpenByWorktree: Record<string, boolean> } {
  const width = ui.sidePanelWidth
  const sidePanelWidth =
    typeof width === 'number' && Number.isFinite(width)
      ? Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width))
      : DEFAULT_SIDE_PANEL_WIDTH
  const sidePanelOpenByWorktree: Record<string, boolean> = {}
  for (const [worktreeId, open] of Object.entries(ui.sidePanelOpenByWorktree ?? {})) {
    if (typeof open === 'boolean') {
      sidePanelOpenByWorktree[worktreeId] = open
    }
  }
  return { sidePanelWidth, sidePanelOpenByWorktree }
}
