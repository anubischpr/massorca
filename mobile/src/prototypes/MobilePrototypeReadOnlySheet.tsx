import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { PrototypePin } from '../../../src/shared/prototype-draft'
import { closeSelection, type PrototypeSetState } from '../../../src/shared/prototype-set-state'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { readOnlySizeLine } from './mobile-prototype-viewer-model'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

function ColorValue({ label, hex }: { label: string; hex: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueLine}>
        <View aria-hidden style={[styles.swatch, { backgroundColor: hex }]} />
        <Text style={styles.mono}>{hex}</Text>
      </View>
    </View>
  )
}

/** The selected pin of a read-only direction: its properties as they are, none of them editable. */
export function MobilePrototypeReadOnlySheet({
  pin,
  state,
  update
}: {
  pin: PrototypePin
  state: PrototypeSetState
  update: Update
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{`${state.view} · ${pin.number} · ${pin.label}`}</Text>
          <Text style={styles.selector} numberOfLines={1}>
            {pin.selector}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => update(closeSelection)}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.heading}>Properties · read-only</Text>
      <View style={styles.fields}>
        <View style={styles.row}>
          <Text style={styles.label}>Text</Text>
          <TextInput
            accessibilityLabel="Text"
            accessibilityState={{ disabled: true }}
            editable={false}
            value={pin.current.text}
            style={styles.input}
          />
        </View>
        <ColorValue label="Text color" hex={pin.current.color} />
        <ColorValue label="Fill" hex={pin.current.bg} />
        <View style={styles.row}>
          <Text style={styles.label}>Size</Text>
          <Text style={styles.mono}>{readOnlySizeLine(pin.current)}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  selector: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 18 },
  heading: { color: colors.textSecondary, fontSize: 13 },
  fields: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 80, color: colors.textSecondary, fontSize: 14 },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  mono: { color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 13 }
})
