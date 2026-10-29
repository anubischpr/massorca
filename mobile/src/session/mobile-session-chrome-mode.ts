import type { MobileSessionTab } from './mobile-session-route-types'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'

/**
 * Which top chrome a session screen draws, decided from what is known on its first render:
 *
 * - `chat`: a native chat or the Terminal panel is on screen; the floating controls draw.
 * - `terminal`: the active tab is known and is not a chat that is still resolving, or the session
 *   has loaded with no tabs at all (so Back and the empty state are reachable); the classic header draws.
 *   Only while MOBILE_LEGACY_SESSION_VIEWS is on.
 * - `notice`: legacy views are off and the session has nothing the new layout draws (no tabs, or a tab
 *   it cannot place); Back draws and the body says why.
 * - `pending`: the session kind is not known yet (connecting, tabs loading, a tab listed without the
 *   active one, or a chat still resolving); a neutral bar with only Back draws, so neither the old
 *   header nor the new controls flash.
 */
export type MobileSessionChromeMode = 'pending' | 'chat' | 'terminal' | 'notice'

export type MobileSessionTabType = MobileSessionTab['type']

export type MobileSessionChromeModeInput = {
  /** The classic screen is allowed; defaults to the kill switch. */
  legacyViews?: boolean
  /** Legacy off: a terminal tab is about to open in the Terminal panel, so no chrome flashes first. */
  entryPending?: boolean
  /** A native chat is on screen for the active tab. */
  showNativeChat: boolean
  /** The Terminal panel holds the session body, so the floating controls draw over it. */
  terminalPanelOpen?: boolean
  connected: boolean
  /** The tabs have not loaded yet (the screen's own loading state). */
  tabsLoading: boolean
  /** Whether any tab is listed, possibly from a cached snapshot. */
  hasTabs: boolean
  /** The active tab's type, or null while the active tab is not known. */
  activeTabType: MobileSessionTabType | null
  /** The active agent-session tab's transcript is still resolving. */
  chatResolving: boolean
}

export function resolveMobileSessionChromeMode(
  input: MobileSessionChromeModeInput
): MobileSessionChromeMode {
  const fallback = (input.legacyViews ?? MOBILE_LEGACY_SESSION_VIEWS) ? 'terminal' : 'notice'
  if (input.showNativeChat || input.terminalPanelOpen === true) {
    return 'chat'
  }
  if (input.activeTabType === null) {
    // Tabs listed but none is the active one: the active tab's kind is unknown, so a chat may be coming.
    if (input.hasTabs || !input.connected || input.tabsLoading) {
      return 'pending'
    }
    return fallback
  }
  if (input.activeTabType === 'agent-session' && input.chatResolving) {
    return 'pending'
  }
  if (input.activeTabType === 'terminal' && fallback === 'notice' && input.entryPending) {
    return 'pending'
  }
  return fallback
}

/** The floating controls draw over every resolved session, the unsupported notice included, so its tab keeps Back, the segments and ⋯. */
export function drawsFloatingChrome(input: {
  chromeMode: MobileSessionChromeMode
  /** The chat or the Terminal panel draws its own controls. */
  sessionControls: boolean
}): boolean {
  return input.sessionControls || input.chromeMode === 'notice'
}

/** The neutral Back-only bar draws only while the session kind is still loading. */
export function drawsPendingBar(chromeMode: MobileSessionChromeMode): boolean {
  return chromeMode === 'pending'
}
