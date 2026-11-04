import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'
import type { MobileDesignSystemVersionRow } from './mobile-prototype-design-system-versions-model'

/** The design system's versions, newest first; only a saved earlier version offers View. */
export function MobilePrototypeDesignSystemVersionsSheet({
  rows,
  onView
}: {
  rows: readonly MobileDesignSystemVersionRow[]
  onView: (version: number) => void
}) {
  return (
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={styles.title}>
        Versions
      </Text>
      <View accessibilityRole="list" style={styles.list}>
        {rows.map((row) => (
          <View key={row.version} style={styles.row}>
            <View style={styles.labels}>
              <Text style={[styles.label, row.state === 'current' && styles.labelCurrent]}>
                {row.label}
              </Text>
              {row.timeLabel === '' ? null : <Text style={styles.time}>{row.timeLabel}</Text>}
            </View>
            {row.state === 'viewable' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View v${row.version}`}
                onPress={() => onView(row.version)}
                style={({ pressed }) => [styles.view, pressed && styles.viewPressed]}
              >
                <Text style={styles.viewText}>View</Text>
              </Pressable>
            ) : row.state === 'unsaved' ? (
              <Text style={styles.note}>not saved</Text>
            ) : null}
          </View>
        ))}
      </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  labels: { flex: 1, gap: 2 },
  label: { color: colors.textPrimary, fontSize: 15 },
  labelCurrent: { fontWeight: '600' },
  time: { color: colors.textSecondary, fontSize: 13 },
  note: { color: colors.textSecondary, fontSize: 13 },
  view: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  viewPressed: { backgroundColor: colors.bgRaised },
  viewText: { color: colors.textPrimary, fontSize: 14 }
})
