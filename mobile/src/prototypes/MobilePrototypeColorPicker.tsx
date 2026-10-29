import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PICKER_HUES, hslToHex, pickerShadeCells } from '../../../src/shared/prototype-color'
import { colors, typography } from '../theme/mobile-theme'

const HUE_SATURATION = 85
const HUE_LIGHTNESS = 50
const SHADE_COLUMNS = 6

/** The custom color picker: twelve hues, twenty-four shades of the hue, a preview and Done. */
export function MobilePrototypeColorPicker({
  label,
  value,
  hue,
  onHue,
  onPick,
  onDone
}: {
  /** "fill" or "text color". */
  label: string
  value: string
  hue: number
  onHue: (hue: number) => void
  onPick: (hex: string) => void
  onDone: () => void
}) {
  // A cell's place in the grid is its identity: the same color can sit in two cells.
  const cells = pickerShadeCells(hue).map((hex, place) => ({ hex, id: `shade-${place}` }))
  const shadeRows = Array.from({ length: cells.length / SHADE_COLUMNS }, (_, row) => ({
    id: `row-${row}`,
    cells: cells.slice(row * SHADE_COLUMNS, (row + 1) * SHADE_COLUMNS)
  }))
  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <Text style={styles.topText}>{`Custom ${label}`}</Text>
        <Text style={styles.topText}>{`hue ${hue}°`}</Text>
      </View>
      <View accessibilityLabel="Hue" style={styles.hues}>
        {PICKER_HUES.map((deg) => (
          <Pressable
            key={deg}
            accessibilityRole="button"
            accessibilityLabel={`Hue ${deg}`}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => onHue(deg)}
            style={[
              styles.hue,
              { backgroundColor: hslToHex(deg, HUE_SATURATION, HUE_LIGHTNESS) },
              hue === deg && styles.selected
            ]}
          />
        ))}
      </View>
      <View accessibilityLabel="Shade" style={styles.shades}>
        {shadeRows.map((row) => (
          <View key={row.id} style={styles.shadeRow}>
            {row.cells.map((cell) => (
              <Pressable
                key={cell.id}
                accessibilityRole="button"
                accessibilityLabel={cell.hex}
                onPress={() => onPick(cell.hex)}
                style={[
                  styles.shade,
                  { backgroundColor: cell.hex },
                  cell.hex === value && styles.selected
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.bottom}>
        <View style={[styles.preview, { backgroundColor: value }]} />
        <Text style={styles.previewHex}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onDone}
          style={styles.done}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  topText: { color: colors.textSecondary, fontSize: 13 },
  hues: { flexDirection: 'row', gap: 3 },
  hue: { flex: 1, height: 28, borderRadius: 4 },
  shades: { gap: 5 },
  shadeRow: { flexDirection: 'row', gap: 5 },
  shade: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  selected: { borderWidth: 2, borderColor: colors.textPrimary },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  previewHex: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: 14
  },
  done: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  doneText: { color: colors.textPrimary, fontSize: 14 }
})
