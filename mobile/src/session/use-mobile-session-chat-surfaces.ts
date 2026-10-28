import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearMobileChatSurfaceSnapshot,
  mobileChatSurfaceKey,
  publishMobileChatSurfaceSnapshot
} from './mobile-chat-surface-snapshot'
import { chatSessionTargetOf, type ChatSessionTab } from './mobile-chat-session-target'
import { mobileNativeChatPlan, mobileNativeChatPlanProgress } from './mobile-native-chat-plan'
import { mobileNativeChatRecordedFileCount } from './mobile-native-chat-recorded-files'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'
import type { MobileArtifactTarget } from './mobile-chat-artifacts-model'
import { mobileSessionSwitcherRows } from './mobile-session-switcher-rows'
import { isTerminalPanelOpen, terminalTabsOf } from './mobile-terminal-panel-model'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

/** The chat surfaces the ⋯ menu opens: the Plan sheet, and the Summary and Artifacts screens. */
type ChatSurface = 'plan' | 'summary' | 'artifacts'

/** A chat surface asked for from another pane, held until its chat is on screen. */
type PendingChatSurface = { surface: ChatSurface; tabId: string; fromTabId: string | null }

/** The chat's own surfaces on the session screen. Composed last, so it reads the chat state the
 *  panel actions cannot see. */
export function useMobileSessionChatSurfaces(scope: MobileSessionPanelRouteActionsModel) {
  const {
    nativeChatController,
    visibleTabs,
    activeSessionTabId,
    activeSessionTab,
    activePanel,
    setActivePanel,
    switchSessionTab,
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
  const [pendingChatSurface, setPendingChatSurface] = useState<PendingChatSurface | null>(null)
  const showNativeChat = nativeChatController.showNativeChat
  const working = showNativeChat && nativeChatController.nativeChatAgentWorking
  const waiting =
    showNativeChat &&
    (nativeChatController.nativeChatPermission != null ||
      nativeChatController.nativeChatQuestion != null ||
      nativeChatController.nativeChatAsk != null)
  // The session chip and the Sessions sheet list chats only: a terminal belongs to the Terminal panel.
  const chatTabs = useMemo(
    () => visibleTabs.filter((tab): tab is ChatSessionTab => tab.type === 'agent-session'),
    [visibleTabs]
  )
  const sessionRows = useMemo(
    () =>
      mobileSessionSwitcherRows(
        chatTabs,
        activeSessionTabId,
        showNativeChat ? { working, waiting } : null
      ),
    [chatTabs, activeSessionTabId, showNativeChat, working, waiting]
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

  // The chat the chat items act on: the active chat, or the worktree's first one from another pane.
  const activeTab = visibleTabs.find((tab) => tab.id === activeSessionTabId) ?? null
  const chatTarget = chatSessionTargetOf(visibleTabs, activeTab)
  // The chip names the chat the chat items act on, so it still reads a chat while a terminal is active.
  const chipRow = sessionRows.find((row) => row.tab.id === chatTarget?.id) ?? null
  // The same menu in every pane: its items follow the worktree, not the pane that is open.
  const headerMenu = resolveMobileSessionHeaderMenu({
    hasChatSession: chatTarget !== null,
    showAgentHistory: showAgentSessionHistoryAction,
    hasSourceControl: !isFolderWorkspaceRoute && !isFloatingWorkspaceRoute,
    showChecks: showChecksAction
  })

  const openSessionsSheet = useCallback(() => setSessionsSheetOpen(true), [])
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
  // Opens a chat surface on the chat that is on screen.
  const openChatSurfaceNow = useCallback(
    (surface: ChatSurface) => {
      if (surface === 'plan') {
        setPlanSheetOpen(true)
        return
      }
      openChatRoute(surface === 'summary' ? 'chat-summary' : 'chat-artifacts')
    },
    [openChatRoute]
  )
  // From another pane the surface waits: the worktree's chat comes on screen first, then it opens.
  const showChatSurface = useCallback(
    (surface: ChatSurface) => {
      if (showNativeChat) {
        openChatSurfaceNow(surface)
        return
      }
      if (chatTarget === null || chatTarget.id === activeSessionTabId) {
        return
      }
      setPendingChatSurface({ surface, tabId: chatTarget.id, fromTabId: activeSessionTabId })
      setActivePanel(null)
      switchSessionTab(chatTarget)
    },
    [
      activeSessionTabId,
      chatTarget,
      openChatSurfaceNow,
      setActivePanel,
      showNativeChat,
      switchSessionTab
    ]
  )
  const openPlanSheet = useCallback(() => showChatSurface('plan'), [showChatSurface])
  const openSummary = useCallback(() => showChatSurface('summary'), [showChatSurface])
  const openArtifacts = useCallback(() => showChatSurface('artifacts'), [showChatSurface])
  // Declared after the snapshot effect above, so a Summary or Artifacts screen finds its chat published.
  useEffect(() => {
    if (pendingChatSurface === null) {
      return
    }
    const { surface, tabId, fromTabId } = pendingChatSurface
    if (activeSessionTabId !== tabId && activeSessionTabId !== fromTabId) {
      // The user moved to another tab first, so the request no longer applies.
      setPendingChatSurface(null)
      return
    }
    if (!showNativeChat || activeSessionTabId !== tabId) {
      return
    }
    setPendingChatSurface(null)
    openChatSurfaceNow(surface)
  }, [activeSessionTabId, openChatSurfaceNow, pendingChatSurface, showNativeChat])

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

  // The native chat and the Terminal panel each draw the floating controls over the session body.
  const terminalPanelOpen = isTerminalPanelOpen({
    activePanel,
    activeTabType: activeSessionTab?.type ?? null,
    terminalTabCount: terminalTabsOf(visibleTabs).length
  })
  const showSessionSwitcherChip = showNativeChat && visibleTabs.length > 0

  return {
    sessionRows,
    activeSessionRow: chipRow,
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
    openArtifactViewer,
    openBranch,
    showHeaderMoreButton: headerMenu.showButton
  }
}

export type MobileSessionChatSurfacesModel = MobileSessionPanelRouteActionsModel &
  ReturnType<typeof useMobileSessionChatSurfaces>
