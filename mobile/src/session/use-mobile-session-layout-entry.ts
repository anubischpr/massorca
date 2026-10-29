import { useEffect, useRef } from 'react'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'
import { resolveLayoutEntryAction } from './mobile-session-layout-entry'
import { resolveMobileSessionActiveKind } from './mobile-session-active-tab'
import { resolveMobileSessionChromeMode } from './mobile-session-chrome-mode'
import type { MobileSessionChatSurfacesModel } from './use-mobile-session-chat-surfaces'

/** Lands a session in the new layout, and names the chrome it draws. */
export function useMobileSessionLayoutEntry(scope: MobileSessionChatSurfacesModel) {
  const {
    showLoadingState,
    showEmptyState,
    connState,
    activeSessionTab,
    activeSessionTabId,
    activeSessionTabTypeRef,
    visibleTabs,
    activePanel,
    setActivePanel,
    handlePanelTap,
    nativeChatController,
    terminalPanelOpen
  } = scope
  // Once per mount, for a file or markdown tab: Back from its Files panel must not reopen it.
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
  // A terminal tab is the Terminal panel's body from any entry point. Keyed on the tab, so every
  // selection of a terminal opens the panel, not only the first one after entry.
  useEffect(() => {
    if (!MOBILE_LEGACY_SESSION_VIEWS && activeTabType === 'terminal' && activePanel === null) {
      setActivePanel('terminal')
    }
  }, [activePanel, activeSessionTabId, activeTabType, setActivePanel])
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
    if (action === 'open-files') {
      handlePanelTap('files')
    }
  }, [action, activeTabType, handlePanelTap, tabsLoaded])

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
