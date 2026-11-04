import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PrototypeListedDirection } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, spacing } from '../theme/mobile-theme'
import { versionRowsOf, type MobilePrototypeVersionRow } from './mobile-prototype-versions-model'

/** One direction's versions, newest first: a tap on any row opens that version. */
export function MobilePrototypeVersionsSheet({
  letter,
  direction,
  onPick
}: {
  letter: string
  direction: PrototypeListedDirection | undefined
  onPick: (row: MobilePrototypeVersionRow) => void
}) {
  const rows = versionRowsOf(direction)
  return (
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={styles.title}>
        {`Versions of ${letter}`}
      </Text>
      <View accessibilityRole="list" style={styles.list}>
        {rows.map((row) => (
          <Pressable
            key={row.version}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, ${row.timeLabel}`}
            onPress={() => onPick(row)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={[styles.label, row.current && styles.labelCurrent]}>{row.label}</Text>
            <View style={styles.trailing}>
              <Text style={styles.time}>{row.timeLabel}</Text>
              {row.current ? null : <Text style={styles.chevron}>›</Text>}
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footnote}>Tap a version to see it.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  list: { gap: 2 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: 10
  },
  rowPressed: { backgroundColor: colors.bgRaised },
  label: { color: colors.textPrimary, fontSize: 15 },
  labelCurrent: { fontWeight: '600' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { color: colors.textSecondary, fontSize: 13 },
  chevron: { color: colors.textSecondary, fontSize: 18 },
  footnote: { color: colors.textSecondary, fontSize: 13 }
})
