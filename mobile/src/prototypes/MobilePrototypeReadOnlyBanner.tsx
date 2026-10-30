import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'

// A 32pt control with 6pt of slop above and below is a 44pt touch target.
const CONTROL_SLOP = { top: 6, bottom: 6 }

/**
 * Shown over a read-only direction as one row: an info icon that explains the view on tap, and the
 * two controls that name the main and change it.
 */
export function MobilePrototypeReadOnlyBanner({
  view,
  main,
  onBackToMain,
  onMakeMain
}: {
  view: string
  main: string
  onBackToMain: () => void
  onMakeMain: () => void
}) {
  const [explained, setExplained] = useState(false)
  return (
    <View accessibilityRole="summary" style={styles.banner}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="What read-only means"
          accessibilityState={{ expanded: explained }}
          onPress={() => setExplained((open) => !open)}
          style={styles.info}
        >
          <View aria-hidden style={styles.infoGlyph}>
            <Text style={styles.infoText}>i</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={CONTROL_SLOP}
          onPress={onBackToMain}
          style={[styles.button, styles.primary]}
        >
          <Text style={styles.primaryText}>Back to main</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={CONTROL_SLOP}
          onPress={onMakeMain}
          style={[styles.button, styles.outline]}
        >
          <Text style={styles.outlineText}>Make main</Text>
        </Pressable>
      </View>
      {explained ? (
        <Text style={styles.text}>
          {'Viewing '}
          <Text style={styles.bold}>{view}</Text>
          {', read-only. Tap any element to see its properties; notes and edits go on the main, '}
          <Text style={styles.bold}>{main}</Text>.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingRight: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  infoGlyph: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textSecondary
  },
  infoText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  button: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  primary: { backgroundColor: colors.textPrimary },
  primaryText: { color: colors.bgBase, fontSize: 13, fontWeight: '500' },
  outline: { borderWidth: 1, borderColor: colors.borderSubtle },
  outlineText: { color: colors.textPrimary, fontSize: 13 },
  text: {
    paddingLeft: spacing.sm,
    paddingBottom: spacing.xs,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20
  },
  bold: { fontWeight: '700' }
})
