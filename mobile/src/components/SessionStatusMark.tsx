import { Activity, Bell, MessageCircleQuestion } from 'lucide-react-native'
import { Animated, StyleSheet, View } from 'react-native'
import { colors } from '../theme/mobile-theme'
import type { SessionStatusGlyph } from '../worktree/session-status-glyph'
import { useWorkingRingRotation } from './use-working-ring-rotation'

// Yellow for live work, the same tone as the desktop working ring and monitoring heartbeat.
export const WORKING_MARK_COLOR = '#eab308'

/**
 * The one status mark at the trailing edge of a branch or session row. Needs-human is the orange
 * question, red is only for failures, and done-and-seen draws nothing.
 */
export function SessionStatusMark({ glyph }: { glyph: SessionStatusGlyph | null }) {
  const rotate = useWorkingRingRotation(glyph === 'working')
  switch (glyph) {
    case null:
      return null
    case 'needs-human':
      return (
        <View style={styles.wrapper} accessibilityLabel="Needs you">
          <MessageCircleQuestion size={12} color={colors.statusOrange} />
        </View>
      )
    case 'failed':
      return (
        <View style={styles.wrapper} accessibilityLabel="Failed">
          <View style={[styles.dot, { backgroundColor: colors.statusRed }]} />
        </View>
      )
    case 'working':
      return (
        <View style={styles.wrapper} accessibilityLabel="Working">
          <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        </View>
      )
    case 'monitoring':
      return (
        <View style={styles.wrapper} accessibilityLabel="Monitoring background tasks">
          <Activity size={12} color={WORKING_MARK_COLOR} />
        </View>
      )
    case 'unconfirmed':
      return (
        <View style={styles.wrapper} accessibilityLabel="Could not confirm">
          <View style={styles.dashedRing} />
        </View>
      )
    case 'unread':
      return (
        <View style={styles.wrapper} accessibilityLabel="Unread">
          <Bell size={10} color={colors.statusAmber} fill={colors.statusAmber} />
        </View>
      )
  }
}

const styles = StyleSheet.create({
  wrapper: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  spinner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: WORKING_MARK_COLOR,
    borderTopColor: 'transparent'
  },
  dashedRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.statusAmber
  }
})
