import { Pressable, Text, View } from 'react-native'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react-native'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import { colors } from '../theme/mobile-theme'
import { MobileBridgeBackgroundWork } from './MobileBridgeBackgroundWork'
import { MobileBridgeWorkingPill } from './MobileChatStatusPillView'
import { MobileNativeChatStopButton } from './MobileNativeChatStopButton'
import { styles } from './mobile-native-chat-view-styles'

/** What the terminal lane's pill reads: the pane's status row and whether the host is heard. */
export type MobileBridgeBackground = { status: AgentStatusEntry | null; connected: boolean }

/** The row between the transcript and the composer: the terminal lane's working pill, the Tools
 *  toggle, and Stop. A structured chat draws its own pill above the composer, so none here. */
export function MobileNativeChatChromeRow({
  structured,
  bridgeBackground,
  scopeKey,
  working,
  toolsExpanded,
  onToggleTools,
  canStop,
  onStop,
  stopHeld
}: {
  structured: boolean
  /** Absent, the pill is a plain status with nothing to open. */
  bridgeBackground?: MobileBridgeBackground
  scopeKey: string
  working: boolean
  toolsExpanded: boolean
  onToggleTools: () => void
  canStop: boolean
  onStop?: () => void
  /** This phone's own Stop request is still in flight. */
  stopHeld: boolean
}): React.JSX.Element {
  return (
    <View style={styles.chromeRow}>
      <View style={styles.chromeLeft}>
        {structured ? null : bridgeBackground ? (
          <MobileBridgeBackgroundWork
            scopeKey={scopeKey}
            status={bridgeBackground.status}
            working={working}
            connected={bridgeBackground.connected}
          />
        ) : working ? (
          <MobileBridgeWorkingPill />
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.chromeToggle, pressed && styles.pressed]}
          onPress={onToggleTools}
          hitSlop={8}
        >
          {toolsExpanded ? (
            <ChevronsDownUp size={14} color={colors.textMuted} strokeWidth={2} />
          ) : (
            <ChevronsUpDown size={14} color={colors.textMuted} strokeWidth={2} />
          )}
          <Text style={styles.chromeToggleLabel}>{toolsExpanded ? 'Collapse' : 'Tools'}</Text>
        </Pressable>
      </View>
      {canStop ? (
        // Only this phone's own request holds Stop: a repeat is how a stuck stop escalates.
        <MobileNativeChatStopButton onStop={onStop} held={stopHeld} />
      ) : null}
    </View>
  )
}
