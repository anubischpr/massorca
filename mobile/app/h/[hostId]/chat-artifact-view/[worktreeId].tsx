import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobileChatArtifactViewer } from '../../../../src/session/MobileChatArtifactViewer'
import { fileNameOf, viewerKindOf } from '../../../../src/session/mobile-chat-artifacts-model'
import { colors, radii, spacing, typography } from '../../../../src/theme/mobile-theme'

/** One file the chat's agent wrote, shown read-only. */
export default function MobileChatArtifactViewScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    worktreeId?: string | string[]
    path?: string | string[]
    name?: string | string[]
    tab?: string | string[]
  }>()
  const hostId = firstParam(params.hostId) ?? ''
  const worktreeId = firstParam(params.worktreeId) ?? ''
  const path = firstParam(params.path) ?? ''
  const tabId = firstParam(params.tab) ?? ''
  const name = firstParam(params.name)
  const kind = viewerKindOf(path)
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
          <Text style={styles.title} numberOfLines={1}>
            {fileNameOf(path) || 'File'}
          </Text>
          {name ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
        </View>
        <View style={styles.kindChip}>
          <Text style={styles.kindText}>{kind.label}</Text>
        </View>
      </View>
      <MobileChatArtifactViewer hostId={hostId} worktreeId={worktreeId} tabId={tabId} path={path} />
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
  },
  kindChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  kindText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.monoFamily,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  }
})
