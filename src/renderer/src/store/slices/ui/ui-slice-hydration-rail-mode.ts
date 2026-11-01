import type { PersistedUIState } from '../../../../../shared/persisted-ui-state-types'
import type { TopLevelView } from '../../../../../shared/ui-chrome-types'

/** Restores the rail mode button's mode and its one-time hint flag from a saved profile. */
export function hydrateRailMode(
  ui: Pick<PersistedUIState, 'railMode' | 'railWorkspacesHintShown'>,
  restoredView: TopLevelView
): { railMode: 'workspaces' | 'bot-teams'; railWorkspacesHintShown: boolean } {
  return {
    // Why: a profile that reopens on the Bot teams page must show the rail in that mode.
    railMode:
      restoredView === 'bot-teams' || ui.railMode === 'bot-teams' ? 'bot-teams' : 'workspaces',
    railWorkspacesHintShown: ui.railWorkspacesHintShown === true
  }
}
