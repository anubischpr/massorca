import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native'
import { FILL_COLOR_PALETTE, TEXT_COLOR_PALETTE } from '../../../src/shared/prototype-color'
import type { PrototypeDraftField, PrototypePin } from '../../../src/shared/prototype-draft'
import {
  editSelected,
  setColorField,
  setHue,
  setPicker,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { colors } from '../theme/mobile-theme'
import { MobilePrototypeColorPicker } from './MobilePrototypeColorPicker'
import { MobilePrototypeColorRow } from './MobilePrototypeColorRow'
import { MobilePrototypePulse } from './MobilePrototypePulse'
import { MobilePrototypeSizeRow } from './MobilePrototypeSizeRow'
import { FONT_SIZE_BOUNDS, parseNumberInput } from './mobile-prototype-viewer-model'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** The control a draft item jumped to, and where to report each row's place for the scroll. */
export type MobilePrototypePulseTarget = {
  field: PrototypeDraftField | null
  nonce: number
  onRowLayout: (field: PrototypeDraftField, event: LayoutChangeEvent) => void
}

/** The Edit tab of a pin: Text, Text color, Fill, Width, Height and Font size. */
export function MobilePrototypeEditFields({
  pin,
  state,
  update,
  pulse
}: {
  pin: PrototypePin
  state: PrototypeSetState
  update: Update
  pulse: MobilePrototypePulseTarget
}) {
  const [fontSizeTyped, setFontSizeTyped] = useState<string | null>(null)
  const row = (field: PrototypeDraftField, children: ReactNode): ReactNode => (
    <MobilePrototypePulse
      ring={pulse.field === field}
      nonce={pulse.nonce}
      onLayout={(event) => pulse.onRowLayout(field, event)}
    >
      {children}
    </MobilePrototypePulse>
  )
  const togglePicker = (field: 'color' | 'bg'): void =>
    update((latest) => setPicker(latest, latest.picker === field ? null : field))
  const colorField = state.picker ?? 'color'

  return (
    <>
      {row(
        'text',
        <View style={styles.field}>
          <Text style={styles.label}>Text</Text>
          <TextInput
            accessibilityLabel="Text"
            value={pin.current.text}
            onChangeText={(text) => update((latest) => editSelected(latest, { text }))}
            style={styles.input}
          />
        </View>
      )}
      {row(
        'color',
        <MobilePrototypeColorRow
          label="Text color"
          palette={TEXT_COLOR_PALETTE}
          value={pin.current.color}
          pickerOpen={state.picker === 'color'}
          onPick={(hex) => update((latest) => setColorField(latest, 'color', hex))}
          onTogglePicker={() => togglePicker('color')}
        />
      )}
      {row(
        'bg',
        <MobilePrototypeColorRow
          label="Fill"
          palette={FILL_COLOR_PALETTE}
          value={pin.current.bg}
          pickerOpen={state.picker === 'bg'}
          onPick={(hex) => update((latest) => setColorField(latest, 'bg', hex))}
          onTogglePicker={() => togglePicker('bg')}
        />
      )}
      {state.picker === null ? null : (
        <MobilePrototypeColorPicker
          label={colorField === 'bg' ? 'fill' : 'text color'}
          value={colorField === 'bg' ? pin.current.bg : pin.current.color}
          hue={state.hue}
          onHue={(hue) => update((latest) => setHue(latest, hue))}
          onPick={(hex) => update((latest) => setColorField(latest, colorField, hex))}
          onDone={() => update((latest) => setPicker(latest, null))}
        />
      )}
      {row(
        'width',
        <MobilePrototypeSizeRow
          label="Width"
          size={pin.current.width}
          onChange={(width) => update((latest) => editSelected(latest, { width }))}
        />
      )}
      {row(
        'height',
        <MobilePrototypeSizeRow
          label="Height"
          size={pin.current.height}
          onChange={(height) => update((latest) => editSelected(latest, { height }))}
        />
      )}
      {row(
        'fontSize',
        <View style={styles.field}>
          <Text style={styles.label}>Font size (px)</Text>
          <TextInput
            accessibilityLabel="Font size (px)"
            keyboardType="numeric"
            value={fontSizeTyped ?? String(pin.current.fontSize)}
            onChangeText={(next) => {
              setFontSizeTyped(next)
              const fontSize = parseNumberInput(next, FONT_SIZE_BOUNDS)
              if (fontSize !== null) {
                update((latest) => editSelected(latest, { fontSize }))
              }
            }}
            onBlur={() => setFontSizeTyped(null)}
            style={[styles.input, styles.number]}
          />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6, padding: 2 },
  label: { color: colors.textSecondary, fontSize: 13 },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  number: { width: 80, paddingHorizontal: 10 }
})
