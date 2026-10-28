import type { MobileSessionTabType } from './mobile-session-chrome-mode'
import type { ActivePanel } from './session-panel-host'

export type LayoutEntryAction = 'none' | 'open-terminal-panel' | 'open-files'

/**
 * What re-entering a session does once its tabs are known. The host reports the tab that was
 * active when the user left, so a terminal lands here with no panel open; the new layout puts it
 * in the Terminal panel. A tab the new layout cannot draw is left to the Unsupported notice.
 */
export function resolveLayoutEntryAction(input: {
  legacyViews: boolean
  tabsLoaded: boolean
  alreadyEntered: boolean
  activeTabType: MobileSessionTabType | null
  activePanel: ActivePanel
}): LayoutEntryAction {
  if (
    input.legacyViews ||
    !input.tabsLoaded ||
    input.alreadyEntered ||
    input.activePanel !== null ||
    input.activeTabType === null
  ) {
    return 'none'
  }
  if (input.activeTabType === 'terminal') {
    return 'open-terminal-panel'
  }
  return input.activeTabType === 'file' || input.activeTabType === 'markdown'
    ? 'open-files'
    : 'none'
}
