import { Pressable, StyleSheet } from 'react-native'
import { colors } from '../theme/mobile-theme'
import type { MobileAccessDisplay } from './mobile-native-chat-access-mode-display'
import { MobileNativeChatAccessIcon } from './MobileNativeChatAccessIcon'

/** Access as a 40pt lock button; its tone and tint name the risk of the mode it runs in. */
export function MobileNativeChatAccessButton({
  accessibleName,
  display,
  disabled,
  onPress
}: {
  accessibleName: string
  display: MobileAccessDisplay
  disabled: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibleName}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        display.tone === 'danger' && styles.dangerButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <MobileNativeChatAccessIcon display={display} size={20} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButton: {
    backgroundColor: colors.statusRedTint
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.7
  }
})
