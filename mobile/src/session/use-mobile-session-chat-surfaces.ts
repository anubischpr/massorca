import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
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
import { isTerminalPanelOpen, terminalTabsOf } from './mobile-terminal-panel-model'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

/** The chat's own surfaces on the session screen. Composed last, so it reads the chat state the
 *  panel actions cannot see. */
export function useMobileSessionChatSurfaces(scope: MobileSessionPanelRouteActionsModel) {
  const {
    nativeChatController,
    visibleTabs,
    activeSessionTabId,
    activeSessionTab,
    activePanel,
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
  // The session names which chat "This chat" means; a chat without one lists every set.
  const prototypeSessionId = nativeChatController.nativeChatPrototypeSend?.sessionId ?? null
  const openPrototypes = useCallback(() => {
    const params = new URLSearchParams()
    if (prototypeSessionId) {
      params.set('session', prototypeSessionId)
    }
    router.push(`/h/${encodeURIComponent(hostId)}/prototypes?${params.toString()}`)
  }, [hostId, prototypeSessionId, router])
  const openPrototypeSet = useCallback(
    (set: PrototypeListedSet) =>
      router.push({
        pathname: set.count <= 1 ? '/h/[hostId]/prototypes/viewer' : '/h/[hostId]/prototypes/set',
        params: { hostId, request: set.requestId }
      }),
    [hostId, router]
  )
  const openBranch = useCallback(() => handlePanelTap('sourceControl'), [handlePanelTap])
  const openPrototypeSettings = useCallback(
    () => router.push(`/h/${encodeURIComponent(hostId)}/prototype-settings`),
    [hostId, router]
  )
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

  // The native chat and the Terminal panel each draw the floating controls over the session body.
  const terminalPanelOpen = isTerminalPanelOpen({
    activePanel,
    activeTabType: activeSessionTab?.type ?? null,
    terminalTabCount: terminalTabsOf(visibleTabs).length
  })
  const showSessionSwitcherChip = showNativeChat && visibleTabs.length > 0

  return {
    sessionRows,
    activeSessionRow: sessionRows.find((row) => row.isActive) ?? null,
    showSessionSwitcherChip,
    showFloatingChrome: showSessionSwitcherChip || terminalPanelOpen,
    terminalPanelOpen,
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
    openPrototypes,
    openArtifactViewer,
    openPrototypeSettings,
    openPrototypeSet,
    openBranch,
    showHeaderMoreButton: headerMenu.showButton
  }
}

export type MobileSessionChatSurfacesModel = MobileSessionPanelRouteActionsModel &
  ReturnType<typeof useMobileSessionChatSurfaces>
