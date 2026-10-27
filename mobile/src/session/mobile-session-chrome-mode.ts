/**
 * Which top chrome a session screen draws, decided from what is known on its first render:
 *
 * - `chat`: a native chat is on screen; the floating controls draw.
 * - `terminal`: a terminal or document tab is on screen, or no tab is pending; the classic header draws.
 * - `pending`: the session kind is not known yet (tabs loading, connecting, or a chat still resolving);
 *   a neutral bar with only Back draws, so neither the old header nor the new controls flash.
 */
export type MobileSessionChromeMode = 'pending' | 'chat' | 'terminal'

export type MobileSessionChromeModeInput = {
  /** A native chat is on screen for the active tab. */
  showNativeChat: boolean
  connected: boolean
  /** The tabs have not loaded yet (the screen's own loading state). */
  tabsLoading: boolean
  /** The active tab's type, or null while the active tab is not known. */
  activeTabType: string | null
  /** The active agent-session tab's transcript is still resolving. */
  chatResolving: boolean
}

export function resolveMobileSessionChromeMode(
  input: MobileSessionChromeModeInput
): MobileSessionChromeMode {
  if (input.showNativeChat) {
    return 'chat'
  }
  if (input.activeTabType === null) {
    return input.connected && !input.tabsLoading ? 'terminal' : 'pending'
  }
  if (input.activeTabType === 'agent-session' && input.chatResolving) {
    return 'pending'
  }
  return 'terminal'
}
