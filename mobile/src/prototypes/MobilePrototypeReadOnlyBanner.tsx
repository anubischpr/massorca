import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'

/** Shown over a read-only direction: where the main is, and the only way to change it. */
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
  return (
    <View accessibilityRole="summary" style={styles.banner}>
      <Text style={styles.text}>
        {'Viewing '}
        <Text style={styles.bold}>{view}</Text>
        {', read-only. Tap any element to see its properties; notes and edits go on the main, '}
        <Text style={styles.bold}>{main}</Text>.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackToMain}
          style={[styles.button, styles.primary]}
        >
          <Text style={styles.primaryText}>Back to main</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onMakeMain}
          style={[styles.button, styles.outline]}
        >
          <Text style={styles.outlineText}>Make main</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    gap: 10,
    marginHorizontal: spacing.md,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted
  },
  text: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  primary: { backgroundColor: colors.textPrimary },
  primaryText: { color: colors.bgBase, fontSize: 14, fontWeight: '500' },
  outline: { borderWidth: 1, borderColor: colors.borderSubtle },
  outlineText: { color: colors.textPrimary, fontSize: 14 }
})
