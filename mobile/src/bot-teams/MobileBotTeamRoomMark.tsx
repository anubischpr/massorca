import { StyleSheet, View } from 'react-native'
import { colors } from '../theme/mobile-theme'

/** The orange dot for a team or task that waits for the person: the Workspaces needs-human colour. */
export function MobileBotTeamWaitingMark() {
  return <View accessibilityLabel="Waiting for you" accessibilityRole="image" style={styles.dot} />
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.statusOrange }
})
