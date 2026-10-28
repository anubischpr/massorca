import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Bot, Check, SquareTerminal } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import {
  mobileBridgeStatusPill,
  mobileStatusPillAccessibilityLabel,
  type MobileStatusPill
} from './mobile-chat-status-pill'

/**
 * The floating status pill: an amber dot, "Working", the turn's clock when there is one, and the
 * running terminal and agent counts when there are any. Once nothing runs it is a grey "Finished"
 * with the finished count. With `onPress` it is a button that opens the background-work sheet;
 * without it, a plain status line.
 */
export function MobileChatStatusPillView({
  pill,
  onPress
}: {
  pill: MobileStatusPill
  onPress?: () => void
}) {
  const content = (
    <>
      <View style={[styles.dot, pill.idle && styles.dotIdle]} />
      <Text style={styles.label}>{pill.label}</Text>
      {pill.elapsed ? <Text style={styles.elapsed}>{pill.elapsed}</Text> : null}
      {pill.terminals !== null || pill.agents !== null ? <View style={styles.divider} /> : null}
      {pill.finished !== null ? (
        <View style={styles.count}>
          <Check size={13} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.countText}>{pill.finished}</Text>
        </View>
      ) : null}
      {pill.terminals !== null ? (
        <View style={styles.count}>
          <SquareTerminal size={13} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.countText}>{pill.terminals}</Text>
        </View>
      ) : null}
      {pill.agents !== null ? (
        <View style={styles.count}>
          <Bot size={13} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.countText}>{pill.agents}</Text>
        </View>
      ) : null}
    </>
  )
  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={mobileStatusPillAccessibilityLabel(pill, false)}
        style={styles.pill}
      >
        {content}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mobileStatusPillAccessibilityLabel(pill, true)}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.md,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.statusAmber
  },
  dotIdle: {
    backgroundColor: colors.textMuted
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.bodySize - 1,
    fontWeight: '500'
  },
  elapsed: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: colors.borderSubtle
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  countText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  }
})

/** The pill a bridge (terminal-lane) chat shows while its turn runs: no clock, no roster to open. */
export function MobileBridgeWorkingPill() {
  return <MobileChatStatusPillView pill={mobileBridgeStatusPill()} />
}
