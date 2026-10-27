import { View } from 'react-native'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileSessionContentRow } from './MobileSessionContentRow'
import { MobileChatFloatingChrome } from './MobileChatFloatingChrome'
import { MobileSessionHeader } from './MobileSessionHeader'
import { MobileSessionSheets } from './MobileSessionSheets'

export function MobileSessionSurface({ controller }: { controller: MobileSessionController }) {
  const { setMobileSessionRootRef, showSessionSwitcherChip } = controller
  return (
    <View ref={setMobileSessionRootRef} style={styles.container}>
      <View style={styles.kavInner}>
        {/* A structured chat floats its controls over the transcript instead of a header and tab strip. */}
        {showSessionSwitcherChip ? null : <MobileSessionHeader controller={controller} />}
        {/* Content-row host (KTD2): on wide, content shares this row with the docked panel as the flex-1 left child. */}
        <MobileSessionContentRow controller={controller} />
        {showSessionSwitcherChip ? <MobileChatFloatingChrome controller={controller} /> : null}
      </View>
      <MobileSessionSheets controller={controller} />
    </View>
  )
}
