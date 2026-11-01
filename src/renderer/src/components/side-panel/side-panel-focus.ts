import { useAppStore } from '../../store'
import { selectSidePanelTabIds } from '../../store/slices/tabs/side-panel-state'

/** Opens the side panel and gives it focus, so the next creation shortcut lands in it. */
export function prepareSidePanelCreation(worktreeId: string): void {
  useAppStore.getState().focusSidePanel(worktreeId)
}

/** Points tab switching at the side panel; false when it has no tabs to switch between. */
export function focusSidePanelForSwitching(worktreeId: string): boolean {
  const state = useAppStore.getState()
  if (selectSidePanelTabIds(state, worktreeId).length === 0) {
    return false
  }
  state.focusSidePanel(worktreeId)
  return true
}
