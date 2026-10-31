import { Pressable, StyleSheet, View } from 'react-native'
import { Monitor, Smartphone } from 'lucide-react-native'
import type { PrototypeViewport } from '../../../src/shared/prototype-set-state'
import { colors } from '../theme/mobile-theme'

const VIEWPORTS: readonly { viewport: PrototypeViewport; label: string; Icon: typeof Monitor }[] = [
  { viewport: 'phone', label: 'Phone', Icon: Smartphone },
  { viewport: 'desktop', label: 'Desktop', Icon: Monitor }
]

/** The viewer's phone and desktop switch: the phone and monitor icons the desktop viewer uses, each named for a screen reader. */
export function MobilePrototypeViewportToggle({
  viewport,
  onChange
}: {
  viewport: PrototypeViewport
  onChange: (viewport: PrototypeViewport) => void
}) {
  return (
    <View accessibilityLabel="Viewport" style={styles.segment}>
      {VIEWPORTS.map(({ viewport: option, label, Icon }) => {
        const selected = viewport === option
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChange(option)}
            style={[styles.segmentButton, selected && styles.segmentOn]}
          >
            <Icon size={18} color={selected ? colors.textPrimary : colors.textSecondary} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  segmentButton: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  segmentOn: { backgroundColor: colors.bgRaised }
})
