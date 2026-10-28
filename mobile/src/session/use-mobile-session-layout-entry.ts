import { useEffect, useRef } from 'react'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'
import { resolveLayoutEntryAction } from './mobile-session-layout-entry'
import { resolveMobileSessionActiveKind } from './mobile-session-active-tab'
import { resolveMobileSessionChromeMode } from './mobile-session-chrome-mode'
import type { MobileSessionChatSurfacesModel } from './use-mobile-session-chat-surfaces'

/** Lands a re-entered session in the new layout once per mount, and names the chrome it draws. */
export function useMobileSessionLayoutEntry(scope: MobileSessionChatSurfacesModel) {
  const {
    showLoadingState,
    showEmptyState,
    connState,
    activeSessionTab,
    activeSessionTabTypeRef,
    visibleTabs,
    activePanel,
    setActivePanel,
    handlePanelTap,
    nativeChatController,
    terminalPanelOpen
  } = scope
  // Once per mount: Back from the Terminal panel with no chat to return to must not reopen it.
  const enteredRef = useRef(false)
  const activeTabType = resolveMobileSessionActiveKind(
    activeSessionTab?.type,
    activeSessionTabTypeRef.current
  )
  const tabsLoaded = connState === 'connected' && !showLoadingState && visibleTabs.length > 0
  const action = resolveLayoutEntryAction({
    legacyViews: MOBILE_LEGACY_SESSION_VIEWS,
    tabsLoaded,
    alreadyEntered: enteredRef.current,
    activeTabType,
    activePanel
  })
  useEffect(() => {
    if (
      MOBILE_LEGACY_SESSION_VIEWS ||
      enteredRef.current ||
      !tabsLoaded ||
      activeTabType === null
    ) {
      return
    }
    enteredRef.current = true
    if (action === 'open-terminal-panel') {
      setActivePanel('terminal')
    } else if (action === 'open-files') {
      handlePanelTap('files')
    }
  }, [action, activeTabType, handlePanelTap, setActivePanel, tabsLoaded])

  const chromeMode = resolveMobileSessionChromeMode({
    legacyViews: MOBILE_LEGACY_SESSION_VIEWS,
    entryPending: action === 'open-terminal-panel',
    showNativeChat: nativeChatController.showNativeChat,
    terminalPanelOpen,
    connected: connState === 'connected',
    tabsLoading: showLoadingState,
    hasTabs: visibleTabs.length > 0,
    activeTabType,
    chatResolving: nativeChatController.nativeChatSession.status === 'loading'
  })
  return {
    chromeMode,
    showUnsupportedNotice: chromeMode === 'notice' && !showEmptyState && !showLoadingState
  }
}
