import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileSessionContentRow } from './MobileSessionContentRow'
import { MobileSessionHeader } from './MobileSessionHeader'
import { MobileSessionSheets } from './MobileSessionSheets'
import { MobileChatChromeLayoutContext } from './mobile-chat-chrome-layout'

export function MobileSessionSurface({ controller }: { controller: MobileSessionController }) {
  const { setMobileSessionRootRef, showSessionSwitcherChip } = controller
  const [chromeHeight, setChromeHeight] = useState(0)
  const layout = useMemo(
    () => ({ height: chromeHeight, setHeight: setChromeHeight }),
    [chromeHeight]
  )
  return (
    <View ref={setMobileSessionRootRef} style={styles.container}>
      <MobileChatChromeLayoutContext.Provider value={layout}>
        <View style={styles.kavInner}>
          {/* A structured chat floats its controls over the transcript instead of a header and tab strip. */}
          {showSessionSwitcherChip ? null : <MobileSessionHeader controller={controller} />}
          {/* Content-row host (KTD2): on wide, content shares this row with the docked panel as the flex-1 left child. */}
          <MobileSessionContentRow controller={controller} />
        </View>
      </MobileChatChromeLayoutContext.Provider>
      <MobileSessionSheets controller={controller} />
    </View>
  )
}
