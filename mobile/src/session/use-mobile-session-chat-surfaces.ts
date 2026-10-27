import { useCallback, useMemo, useState } from 'react'
import { mobileNativeChatPlan, mobileNativeChatPlanProgress } from './mobile-native-chat-plan'
import { mobileSessionSwitcherRows } from './mobile-session-switcher-rows'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

/** The chat's own surfaces on the session screen. Composed last, so it reads the chat state the
 *  panel actions cannot see. */
export function useMobileSessionChatSurfaces(scope: MobileSessionPanelRouteActionsModel) {
  const {
    nativeChatController,
    visibleTabs,
    activeSessionTabId,
    showAgentSessionHistoryAction,
    showChecksAction
  } = scope
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false)
  const [planSheetOpen, setPlanSheetOpen] = useState(false)
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

  const messages = nativeChatController.nativeChatSession.messages
  const transcriptPlan = useMemo(
    () => (showNativeChat ? mobileNativeChatPlan(messages) : null),
    [messages, showNativeChat]
  )
  const plan = transcriptPlan && transcriptPlan.tasks.length > 0 ? transcriptPlan : null
  const planProgress = useMemo(() => (plan ? mobileNativeChatPlanProgress(plan) : null), [plan])

  const openSessionsSheet = useCallback(() => setSessionsSheetOpen(true), [])
  const openPlanSheet = useCallback(() => setPlanSheetOpen(true), [])
  return {
    sessionRows,
    activeSessionRow: sessionRows.find((row) => row.isActive) ?? null,
    showSessionSwitcherChip: showNativeChat && visibleTabs.length > 0,
    openSessionsSheet,
    sessionsSheetOpen,
    setSessionsSheetOpen,
    planSteps: plan,
    planProgress,
    openPlanSheet,
    planSheetOpen,
    setPlanSheetOpen,
    showHeaderMoreButton: showAgentSessionHistoryAction || showChecksAction || plan !== null
  }
}
