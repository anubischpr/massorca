import { Pressable, StyleSheet } from 'react-native'
import { MobileNativeChatEffortMeter } from './MobileNativeChatEffortMeter'

/** Effort as a 40pt button showing a five-bar meter; the first `level` bars are lit. */
export function MobileNativeChatEffortButton({
  accessibleName,
  level,
  disabled,
  onPress
}: {
  accessibleName: string
  level: number
  disabled: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibleName}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
    >
      <MobileNativeChatEffortMeter level={level} disabled={disabled} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    opacity: 0.7
  }
})
