import { Pressable, StyleSheet, Text, View } from 'react-native'
import { keyedEntries } from '../../../src/shared/prototype-entry-keys'
import type { PrototypeListedDesignSystem } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { mobilePrototypeSystemLine } from './mobile-prototype-list-model'

/** A project's Design system row, pinned above its sets: a swatch icon when detected, then its line. */
export function MobilePrototypeSystemRow({
  system,
  onPress
}: {
  system: PrototypeListedDesignSystem
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Design system"
      onPress={onPress}
      style={styles.row}
    >
      {system.status === 'detected' ? <SwatchIcon swatches={system.swatches} /> : null}
      <View style={styles.text}>
        <Text style={styles.title}>Design system</Text>
        <Text style={styles.line}>{mobilePrototypeSystemLine(system)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

// Four color values in a 2x2 grid: two explicit rows, so the grid never depends on the cells wrapping.
function SwatchIcon({ swatches }: { swatches: readonly string[] }) {
  const rows = [swatches.slice(0, 2), swatches.slice(2, 4)]
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={styles.icon}>
      {rows.map((row, index) => (
        <View key={index} style={styles.swatchRow}>
          {keyedEntries(row, (color) => color).map(({ key, entry: color }) => (
            <View key={key} style={[styles.cell, { backgroundColor: color }]} />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card - 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  icon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    overflow: 'hidden'
  },
  swatchRow: { flexDirection: 'row', gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 3 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  line: { color: colors.textSecondary, fontSize: 13 },
  chevron: { color: colors.textSecondary, fontSize: typography.bodySize }
})
