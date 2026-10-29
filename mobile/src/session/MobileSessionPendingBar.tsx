import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'

/** The neutral top bar while a session's kind is still loading: Back only, no tabs or chips, so
 *  neither the classic header nor the chat controls show before the screen knows which to draw. */
export function MobileSessionPendingBar({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to worktrees"
        hitSlop={8}
        onPress={onBack}
        style={styles.back}
      >
        <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
