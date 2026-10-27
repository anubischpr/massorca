import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileSessionContentRow } from './MobileSessionContentRow'
import { MobileSessionHeader } from './MobileSessionHeader'
import { MobileSessionPendingBar } from './MobileSessionPendingBar'
import { MobileSessionSheets } from './MobileSessionSheets'
import { MobileChatChromeLayoutContext } from './mobile-chat-chrome-layout'
import { resolveMobileSessionChromeMode } from './mobile-session-chrome-mode'

export function MobileSessionSurface({ controller }: { controller: MobileSessionController }) {
  const {
    setMobileSessionRootRef,
    showLoadingState,
    connState,
    activeSessionTab,
    visibleTabs,
    nativeChatController,
    requestLeaveSession
  } = controller
  const [chromeHeight, setChromeHeight] = useState(0)
  const layout = useMemo(
    () => ({ height: chromeHeight, setHeight: setChromeHeight }),
    [chromeHeight]
  )
  // The top bar is chosen from what is known on this render, so a session never flashes the other
  // chrome while its kind loads.
  const chromeMode = resolveMobileSessionChromeMode({
    showNativeChat: nativeChatController.showNativeChat,
    connected: connState === 'connected',
    tabsLoading: showLoadingState,
    hasTabs: visibleTabs.length > 0,
    activeTabType: activeSessionTab?.type ?? null,
    chatResolving: nativeChatController.nativeChatSession.status === 'loading'
  })
  return (
    <View ref={setMobileSessionRootRef} style={styles.container}>
      <MobileChatChromeLayoutContext.Provider value={layout}>
        <View style={styles.kavInner}>
          {chromeMode === 'terminal' ? <MobileSessionHeader controller={controller} /> : null}
          {chromeMode === 'pending' ? (
            <MobileSessionPendingBar onBack={requestLeaveSession} />
          ) : null}
          {/* Content-row host (KTD2): on wide, content shares this row with the docked panel as the flex-1 left child. */}
          <MobileSessionContentRow controller={controller} />
        </View>
      </MobileChatChromeLayoutContext.Provider>
      <MobileSessionSheets controller={controller} />
    </View>
  )
}
