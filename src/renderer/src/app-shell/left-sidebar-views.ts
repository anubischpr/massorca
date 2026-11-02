import type { TopLevelView } from '../../../shared/ui-chrome-types'

/**
 * The views the left sidebar belongs to: the ones the Workspaces / Bot Teams rail button opens.
 * Every other page uses the whole space beside the rail, as the approved canvas draws it.
 */
export function isLeftSidebarView(view: TopLevelView): boolean {
  return view === 'terminal' || view === 'create-chat' || view === 'bot-teams'
}

/** The shortcut and the menu item toggle the sidebar only where it exists, so it is never left toggled out of sight. */
export function toggleLeftSidebarWhereShown(state: {
  activeView: TopLevelView
  toggleSidebar: () => void
}): boolean {
  if (!isLeftSidebarView(state.activeView)) {
    return false
  }
  state.toggleSidebar()
  return true
}
