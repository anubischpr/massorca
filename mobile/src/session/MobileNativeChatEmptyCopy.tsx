import { Text, View } from 'react-native'
import { styles } from './mobile-native-chat-view-styles'

/** The title and subtitle a chat with nothing to show yet says, in the transcript's place. */
export function MobileNativeChatEmptyCopy({
  title,
  subtitle
}: {
  title: string
  subtitle: string
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  )
}
