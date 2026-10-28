import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, MoreHorizontal, X } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

const ROUND = 40

/** Close, the host chip that opens "Run on", and the more-options button, floating over the prompt. */
export function CreateSessionTopBar({
  hostLabel,
  disabled,
  onClose,
  onOpenHost,
  onOpenMore
}: {
  hostLabel: string
  disabled: boolean
  onClose: () => void
  onOpenHost: () => void
  onOpenMore: () => void
}): React.JSX.Element {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        onPress={onClose}
        hitSlop={4}
      >
        <X size={18} color={colors.textPrimary} strokeWidth={2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Run on, ${hostLabel}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={({ pressed }) => [styles.hostChip, pressed && styles.pressed]}
        onPress={onOpenHost}
      >
        <View style={styles.hostDot} />
        <Text style={styles.hostLabel} numberOfLines={1}>
          {hostLabel || 'No host'}
        </Text>
        <ChevronDown size={14} color={colors.textMuted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        onPress={onOpenMore}
        hitSlop={4}
      >
        <MoreHorizontal size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  hostChip: {
    flexShrink: 1,
    height: ROUND,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    borderRadius: ROUND / 2,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  hostDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.statusGreen },
  hostLabel: { flexShrink: 1, color: colors.textPrimary, fontSize: typography.metaSize },
  pressed: { opacity: 0.7 }
})
