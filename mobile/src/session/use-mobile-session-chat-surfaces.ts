import { useCallback, useMemo, useState } from 'react'
import { mobileSessionSwitcherRows } from './mobile-session-switcher-rows'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

/** The chat's own surfaces on the session screen. Composed last, so it reads the chat state the
 *  panel actions cannot see. */
export function useMobileSessionChatSurfaces(scope: MobileSessionPanelRouteActionsModel) {
  const { nativeChatController, visibleTabs, activeSessionTabId } = scope
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false)
  const showNativeChat = nativeChatController.showNativeChat
  const working = showNativeChat && nativeChatController.nativeChatAgentWorking
  const waiting =
    showNativeChat &&
    (nativeChatController.nativeChatPermission != null ||
      nativeChatController.nativeChatQuestion != null ||
      nativeChatController.nativeChatAsk != null)
  const sessionRows = useMemo(
    () =>
      mobileSessionSwitcherRows(
        visibleTabs,
        activeSessionTabId,
        showNativeChat ? { working, waiting } : null
      ),
    [visibleTabs, activeSessionTabId, showNativeChat, working, waiting]
  )
  const openSessionsSheet = useCallback(() => setSessionsSheetOpen(true), [])
  return {
    sessionRows,
    activeSessionRow: sessionRows.find((row) => row.isActive) ?? null,
    showSessionSwitcherChip: showNativeChat && visibleTabs.length > 0,
    openSessionsSheet,
    sessionsSheetOpen,
    setSessionsSheetOpen
  }
}
