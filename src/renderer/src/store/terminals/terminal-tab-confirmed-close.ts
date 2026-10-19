import type { AppState } from '../types'
import { buildTerminalTabRetirementPlan } from '../slices/terminal-tab-retirement'
import { startConfirmedTerminalTabProviderRetirement } from './terminal-tab-close-providers'

/**
 * Removes a terminal tab the way an ordinary user close does, retiring its processes with the
 * awaited variant instead. Resolves true only when every process the tab held confirmed its exit.
 */
export function closeTerminalTabConfirmingExit(state: AppState, tabId: string): Promise<boolean> {
  const retirementPlan = buildTerminalTabRetirementPlan(state, tabId)
  // Why: the kills start before the tab leaves state, as an ordinary close does, and the store close skips its own teardown so no PTY is killed twice.
  const exitConfirmed = startConfirmedTerminalTabProviderRetirement({
    retirementPlan,
    state
  })
  state.closeTab(tabId, {
    reason: 'user',
    // Why: a reopened copy of this tab would resume the session the structured chat is about to own.
    captureRecentlyClosed: false,
    precomputedRetirementPlan: retirementPlan,
    providerRetirementOwnedByCaller: true
  })
  return exitConfirmed
}
