import { Pressable, StyleSheet, Text } from 'react-native'
import { ChevronRight, ListChecks } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

type RowProps = {
  /** The checklist's title, when the agent gave one. */
  title: string | null
  checked: number
  total: number
  /** Opens the chat's Checklist sheet. */
  onPress: () => void
}

/** The transcript's stand-in for a checklist fence: one tappable row that opens the Checklist sheet. */
export function MobileNativeChatChecklistRow({ title, checked, total, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Checklist"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <ListChecks size={16} color={colors.textSecondary} strokeWidth={2.1} />
      <Text style={styles.label}>Checklist</Text>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <Text style={styles.count}>{`${checked}/${total}`}</Text>
      <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.1} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontSize: typography.bodySize
  },
  count: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
