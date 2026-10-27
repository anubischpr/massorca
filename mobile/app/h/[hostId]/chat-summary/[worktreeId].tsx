import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { colors, spacing, typography } from '../../../../src/theme/mobile-theme'

/** The chat summary. Placeholder: the screen body lands with the summary build. */
export default function MobileChatSummaryScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ name?: string | string[] }>()
  const name = firstParam(params.name)
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Summary</Text>
          {name ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
