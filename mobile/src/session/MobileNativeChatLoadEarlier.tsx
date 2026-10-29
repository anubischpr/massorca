import { ActivityIndicator, Pressable, Text } from 'react-native'
import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-native-chat-view-styles'

/** The transcript's first row while older messages exist: one tap, or a spinner while they load. */
export function MobileNativeChatLoadEarlier({
  loading,
  onPress
}: {
  loading: boolean
  onPress: () => void
}) {
  return (
    <Pressable style={styles.loadEarlier} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Text style={styles.loadEarlierText}>Load earlier messages</Text>
      )}
    </Pressable>
  )
}
