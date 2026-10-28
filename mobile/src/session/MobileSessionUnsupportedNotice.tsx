import { Pressable, Text, View } from 'react-native'
import { styles } from './mobile-session-styles'
import { terminalTabsOf } from './mobile-terminal-panel-model'
import type { MobileSessionController } from './use-mobile-session-controller'

/** What the new layout offers for a tab it cannot draw, inside its own chrome. */
export function MobileSessionUnsupportedNotice({
  controller
}: {
  controller: MobileSessionController
}) {
  const { visibleTabs, activeSessionTab, handlePanelTap } = controller
  const canOpenTerminal = terminalTabsOf(visibleTabs).length > 0
  const canOpenFiles = activeSessionTab?.type === 'file' || activeSessionTab?.type === 'markdown'
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Unsupported session</Text>
      <View style={styles.emptyActions}>
        {canOpenTerminal ? (
          <Pressable
            accessibilityRole="button"
            style={styles.createButton}
            onPress={() => handlePanelTap('terminal')}
          >
            <Text style={styles.createButtonText}>Open Terminal</Text>
          </Pressable>
        ) : null}
        {canOpenFiles ? (
          <Pressable
            accessibilityRole="button"
            style={styles.createButton}
            onPress={() => handlePanelTap('files')}
          >
            <Text style={styles.createButtonText}>Open Files</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
