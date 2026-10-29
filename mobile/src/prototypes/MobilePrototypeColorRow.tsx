import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg'
import { hslToHex, isHexColor } from '../../../src/shared/prototype-color'
import { colors, typography } from '../theme/mobile-theme'

const SWATCH = 40
const RING_GAP = 2
const WHEEL_SLICES = 36

/** The rainbow swatch that opens the custom picker: a hue wheel clipped to the swatch. */
function RainbowSwatch() {
  const slices = Array.from({ length: WHEEL_SLICES }, (_, index) => {
    const from = ((index * 360) / WHEEL_SLICES) * (Math.PI / 180)
    const to = (((index + 1) * 360) / WHEEL_SLICES) * (Math.PI / 180)
    const center = SWATCH / 2
    const reach = SWATCH
    const point = (angle: number): string =>
      `${center + reach * Math.cos(angle)} ${center + reach * Math.sin(angle)}`
    return {
      key: index,
      d: `M ${center} ${center} L ${point(from)} L ${point(to)} Z`,
      fill: hslToHex((index * 360) / WHEEL_SLICES, 85, 50)
    }
  })
  return (
    <Svg width={SWATCH} height={SWATCH}>
      <Defs>
        <ClipPath id="swatch">
          <Rect width={SWATCH} height={SWATCH} rx={10} />
        </ClipPath>
      </Defs>
      {slices.map((slice) => (
        <Path key={slice.key} d={slice.d} fill={slice.fill} clipPath="url(#swatch)" />
      ))}
    </Svg>
  )
}

/**
 * One color control on one compact row: two palette swatches, the custom picker's swatch and the hex
 * field. A value typed here applies once it is a full hex color.
 */
export function MobilePrototypeColorRow({
  label,
  palette,
  value,
  pickerOpen,
  onPick,
  onTogglePicker
}: {
  /** "Text color" or "Fill". */
  label: string
  palette: readonly string[]
  value: string
  pickerOpen: boolean
  onPick: (hex: string) => void
  onTogglePicker: () => void
}) {
  const [typed, setTyped] = useState<string | null>(null)
  const custom = pickerOpen || !palette.includes(value)
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        {palette.map((hex) => (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${hex}`}
            onPress={() => {
              setTyped(null)
              onPick(hex)
            }}
            style={[styles.ring, value === hex && styles.ringOn]}
          >
            <View style={[styles.swatch, { backgroundColor: hex }]} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label === 'Fill' ? 'Custom fill' : 'Custom text color'}
          onPress={onTogglePicker}
          style={[styles.ring, custom && styles.ringOn]}
        >
          <View style={styles.swatch}>
            <RainbowSwatch />
          </View>
        </Pressable>
        <TextInput
          accessibilityLabel={label === 'Fill' ? 'Fill hex' : 'Text color hex'}
          autoCapitalize="none"
          autoCorrect={false}
          value={typed ?? value}
          onChangeText={(next) => {
            setTyped(next)
            if (isHexColor(next)) {
              onPick(next)
            }
          }}
          onBlur={() => setTyped(null)}
          style={styles.hex}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 6, padding: 2 },
  label: { color: colors.textSecondary, fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ring: {
    width: SWATCH + RING_GAP * 4,
    height: SWATCH + RING_GAP * 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  ringOn: { borderColor: colors.accentBlue },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  hex: {
    width: 104,
    height: SWATCH,
    marginLeft: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: 13
  }
})
