import type { AppState } from '../types'
import { buildTerminalTabRetirementPlan } from '../slices/terminal-tab-retirement'
import { startConfirmedTerminalTabProviderRetirement } from './terminal-tab-close-providers'

/**
 * Removes a terminal tab the way an ordinary user close does, but only once every process the tab
 * held confirmed its exit. Resolves true when the tab was removed; false leaves it in place, so a
 * terminal that may still run stays visible.
 */
export async function closeTerminalTabConfirmingExit(
  state: AppState,
  tabId: string
): Promise<boolean> {
  const retirementPlan = buildTerminalTabRetirementPlan(state, tabId)
  const exitConfirmed = await startConfirmedTerminalTabProviderRetirement({
    retirementPlan,
    state
  })
  if (!exitConfirmed) {
    return false
  }
  state.closeTab(tabId, {
    reason: 'user',
    // Why: a reopened copy of this tab would resume the session the structured chat is about to own.
    captureRecentlyClosed: false,
    precomputedRetirementPlan: retirementPlan,
    providerRetirementOwnedByCaller: true
  })
  return true
}
