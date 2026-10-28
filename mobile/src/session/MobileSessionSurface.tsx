import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileSessionContentRow } from './MobileSessionContentRow'
import { MobileSessionHeader } from './MobileSessionHeader'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'
import { MobileSessionPendingBar } from './MobileSessionPendingBar'
import { MobileSessionSheets } from './MobileSessionSheets'
import { MobileChatChromeLayoutContext } from './mobile-chat-chrome-layout'

export function MobileSessionSurface({ controller }: { controller: MobileSessionController }) {
  const { setMobileSessionRootRef, chromeMode, requestLeaveSession } = controller
  const [chromeHeight, setChromeHeight] = useState(0)
  const layout = useMemo(
    () => ({ height: chromeHeight, setHeight: setChromeHeight }),
    [chromeHeight]
  )
  // The top bar is chosen from what is known on this render (see the layout-entry hook), so a
  // session never flashes the other chrome while its kind loads.
  return (
    <View ref={setMobileSessionRootRef} style={styles.container}>
      <MobileChatChromeLayoutContext.Provider value={layout}>
        <View style={styles.kavInner}>
          {MOBILE_LEGACY_SESSION_VIEWS && chromeMode === 'terminal' ? (
            <MobileSessionHeader controller={controller} />
          ) : null}
          {chromeMode === 'pending' || chromeMode === 'notice' ? (
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
