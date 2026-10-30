import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, typography } from '../theme/mobile-theme'

/** The bar under the tabs while the draft holds changes: how many are ready, and the way into the draft. */
export function MobilePrototypeDesignSystemBar({
  count,
  agentName,
  onPress
}: {
  count: number
  agentName: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Review & send"
      onPress={onPress}
      style={styles.bar}
    >
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{`changes ready for ${agentName}`}</Text>
      <Text style={styles.action}>Review &amp; send ›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 48,
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
    color: colors.bgBase,
    fontFamily: typography.monoFamily,
    fontSize: 12
  },
  label: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  action: { color: colors.textSecondary, fontSize: 14 }
})
