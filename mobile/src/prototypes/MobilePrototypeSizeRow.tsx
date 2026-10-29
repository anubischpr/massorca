import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { PrototypeSize } from '../../../src/shared/prototype-draft'
import { colors } from '../theme/mobile-theme'
import { clampToBounds, parseNumberInput, sizeBoundsOf } from './mobile-prototype-viewer-model'

const UNITS = ['px', '%', 'auto'] as const

/** Width or Height: a number and its unit; with `auto` the number is dimmed, as it does not apply. */
export function MobilePrototypeSizeRow({
  label,
  size,
  onChange
}: {
  label: 'Width' | 'Height'
  size: PrototypeSize
  onChange: (next: PrototypeSize) => void
}) {
  const [typed, setTyped] = useState<string | null>(null)
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TextInput
          accessibilityLabel={`${label} value`}
          keyboardType="numeric"
          value={typed ?? String(size.value)}
          onChangeText={(next) => {
            setTyped(next)
            const value = parseNumberInput(next, sizeBoundsOf(size.unit))
            if (value !== null) {
              onChange({ value, unit: size.unit })
            }
          }}
          onBlur={() => setTyped(null)}
          style={[styles.input, size.unit === 'auto' && styles.dimmed]}
        />
        <View accessibilityLabel={`${label} unit`} style={styles.units}>
          {UNITS.map((unit) => (
            <Pressable
              key={unit}
              accessibilityRole="button"
              accessibilityState={{ selected: size.unit === unit }}
              onPress={() => {
                setTyped(null)
                // A value that the new unit cannot take (say 300 as a percentage) is pinned into its range.
                onChange({ value: clampToBounds(size.value, sizeBoundsOf(unit)), unit })
              }}
              style={[styles.unit, size.unit === unit && styles.unitOn]}
            >
              <Text style={[styles.unitText, size.unit === unit && styles.unitTextOn]}>{unit}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 6, padding: 2 },
  label: { color: colors.textSecondary, fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    width: 80,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  dimmed: { opacity: 0.4 },
  units: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.bgBase
  },
  unit: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  unitOn: { backgroundColor: colors.bgRaised },
  unitText: { color: colors.textSecondary, fontSize: 14 },
  unitTextOn: { color: colors.textPrimary }
})
