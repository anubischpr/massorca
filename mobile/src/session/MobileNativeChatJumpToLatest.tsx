import { Pressable } from 'react-native'
import { ArrowDown } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-native-chat-view-styles'

/** The floating control that returns a scrolled-back transcript to its newest message. */
export function MobileNativeChatJumpToLatest({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Scroll to latest"
      style={[styles.fab, styles.fabBottom]}
      onPress={onPress}
    >
      <ArrowDown size={18} color={colors.textPrimary} strokeWidth={2.2} />
    </Pressable>
  )
}
