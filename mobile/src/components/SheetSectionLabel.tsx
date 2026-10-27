import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

/** A sheet section header: a small uppercase mono label, a hairline, and an optional count. */
export function SheetSectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rule} />
      {count === undefined ? null : <Text style={styles.count}>{count}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle
  },
  count: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily
  }
})
