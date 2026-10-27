import { useCallback, useMemo, useState } from 'react'
import { mobileNativeChatPlan, mobileNativeChatPlanProgress } from './mobile-native-chat-plan'
import { mobileNativeChatRecordedFileCount } from './mobile-native-chat-recorded-files'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'
import { mobileSessionSwitcherRows } from './mobile-session-switcher-rows'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

/** The chat's own surfaces on the session screen. Composed last, so it reads the chat state the
 *  panel actions cannot see. */
export function useMobileSessionChatSurfaces(scope: MobileSessionPanelRouteActionsModel) {
  const {
    nativeChatController,
    visibleTabs,
    activeSessionTabId,
    showChecksAction,
    isFolderWorkspaceRoute,
    isFloatingWorkspaceRoute,
    hostId,
    worktreeId,
    worktreeName,
    router,
    handlePanelTap
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
  const recordedFileCount = useMemo(
    () => (showNativeChat ? mobileNativeChatRecordedFileCount(messages) : 0),
    [messages, showNativeChat]
  )
  const headerMenu = resolveMobileSessionHeaderMenu({
    showNativeChat,
    hasSourceControl: !isFolderWorkspaceRoute && !isFloatingWorkspaceRoute,
    showChecks: showChecksAction,
    hasPlan: plan !== null
  })

  const openSessionsSheet = useCallback(() => setSessionsSheetOpen(true), [])
  const openPlanSheet = useCallback(() => setPlanSheetOpen(true), [])
  // The active tab names which chat the summary or the artifacts belong to.
  const openChatRoute = useCallback(
    (surface: 'chat-summary' | 'chat-artifacts') => {
      const params = new URLSearchParams({ name: worktreeName || '' })
      if (activeSessionTabId) {
        params.set('tab', activeSessionTabId)
      }
      router.push(`/h/${hostId}/${surface}/${encodeURIComponent(worktreeId)}?${params.toString()}`)
    },
    [activeSessionTabId, hostId, router, worktreeId, worktreeName]
  )
  const openSummary = useCallback(() => openChatRoute('chat-summary'), [openChatRoute])
  const openArtifacts = useCallback(() => openChatRoute('chat-artifacts'), [openChatRoute])
  const openBranch = useCallback(() => handlePanelTap('sourceControl'), [handlePanelTap])

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
    headerMenu,
    recordedFileCount,
    openSummary,
    openArtifacts,
    openBranch,
    showHeaderMoreButton: headerMenu.showButton
  }
}
