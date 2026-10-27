import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearMobileChatSurfaceSnapshot,
  mobileChatSurfaceKey,
  publishMobileChatSurfaceSnapshot
} from './mobile-chat-surface-snapshot'
import { mobileNativeChatPlan, mobileNativeChatPlanProgress } from './mobile-native-chat-plan'
import { mobileNativeChatRecordedFileCount } from './mobile-native-chat-recorded-files'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'
import type { MobileArtifactTarget } from './mobile-chat-artifacts-model'
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
    showAgentSessionHistoryAction,
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
  // The Summary and Artifacts screens read the chat from here: they push over this screen, so the
  // snapshot is the chat on screen, without a second transcript subscription.
  const surfaceKey = mobileChatSurfaceKey(hostId, worktreeId, activeSessionTabId ?? '')
  const surfaceAgent = nativeChatController.nativeChatAgent
  const surfaceWorkingStartedAt = nativeChatController.nativeChatWorkingStartedAt
  const surfaceRecordedSource = nativeChatController.nativeChatVisualSource
  useEffect(() => {
    if (!showNativeChat || !activeSessionTabId) {
      return
    }
    publishMobileChatSurfaceSnapshot(surfaceKey, {
      messages,
      agent: surfaceAgent,
      working,
      workingStartedAt: working ? surfaceWorkingStartedAt : null,
      recordedSource: surfaceRecordedSource
    })
  }, [
    surfaceKey,
    activeSessionTabId,
    showNativeChat,
    messages,
    surfaceAgent,
    working,
    surfaceWorkingStartedAt,
    surfaceRecordedSource
  ])
  useEffect(() => () => clearMobileChatSurfaceSnapshot(surfaceKey), [surfaceKey])
  const headerMenu = resolveMobileSessionHeaderMenu({
    showNativeChat,
    showAgentHistory: showAgentSessionHistoryAction,
    hasSourceControl: !isFolderWorkspaceRoute && !isFloatingWorkspaceRoute,
    showChecks: showChecksAction
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
  // Same route the Artifacts list opens, for a page tapped from the transcript.
  const openArtifactViewer = useCallback(
    (target: MobileArtifactTarget) => {
      const params = new URLSearchParams(
        target.kind === 'visual' ? { visual: target.file } : { path: target.path }
      )
      params.set('name', worktreeName || '')
      if (activeSessionTabId) {
        params.set('tab', activeSessionTabId)
      }
      router.push(
        `/h/${hostId}/chat-artifact-view/${encodeURIComponent(worktreeId)}?${params.toString()}`
      )
    },
    [activeSessionTabId, hostId, router, worktreeId, worktreeName]
  )

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
    openArtifactViewer,
    openBranch,
    showHeaderMoreButton: headerMenu.showButton
  }
}
