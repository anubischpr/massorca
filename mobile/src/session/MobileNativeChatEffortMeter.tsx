import { StyleSheet, View } from 'react-native'
import { colors } from '../theme/mobile-theme'

// Why: five rising bars read as a level at a glance; heights are fixed so the meter never reflows.
const BAR_HEIGHTS = [6, 9, 12, 15, 18] as const

/** Five-bar effort meter; the first `level` bars are lit. Shared by the button and sheet rows. */
export function MobileNativeChatEffortMeter({
  level,
  disabled = false
}: {
  level: number
  disabled?: boolean
}): React.JSX.Element {
  return (
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
  )
}

const styles = StyleSheet.create({
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
  }
})
