import { Pressable, StyleSheet, View } from 'react-native'
import { colors } from '../theme/mobile-theme'

// Why: five rising bars read as a level at a glance; heights are fixed so the meter never reflows.
const BAR_HEIGHTS = [6, 9, 12, 15, 18] as const

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
      <View style={[styles.meter, disabled && styles.disabled]}>
        {BAR_HEIGHTS.map((height, index) => (
          <View
            key={height}
            style={[
              styles.bar,
              { height, backgroundColor: index < level ? colors.textPrimary : colors.textMuted }
            ]}
          />
        ))}
      </View>
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
  meter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2
  },
  bar: {
    width: 3,
    borderRadius: 1.5
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.7
  }
})
