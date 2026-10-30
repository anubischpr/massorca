import { useEffect, useRef } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent
} from 'react-native'
import type { PrototypeDraftField, PrototypePin } from '../../../src/shared/prototype-draft'
import {
  closeSelection,
  noteFor,
  setNote,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { colors, spacing, typography } from '../theme/mobile-theme'
import {
  MobilePrototypeEditFields,
  type MobilePrototypePulseTarget
} from './MobilePrototypeEditFields'
import { MobilePrototypePulse } from './MobilePrototypePulse'
import { MobilePrototypeSheetTabs } from './MobilePrototypeSheetTabs'
import {
  NOTE_EXAMPLE_CHIPS,
  NOTE_LABEL,
  NOTE_PLACEHOLDER,
  noteFromExampleChip,
  selectedPinEditCount
} from './mobile-prototype-viewer-model'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

export type MobilePrototypePinTab = 'edit' | 'note'

/** How far the sheet may grow: a share of the screen, so the frame behind it stays in view. */
const SHEET_MAX_HEIGHT_SHARE = 0.8
/** Where a jumped-to control rests below the top of the sheet's scroll. */
const SCROLL_MARGIN = 80

/**
 * The selected pin of the main: its heading, an Edit tab and a Note tab. Every change and note
 * joins the draft on its own. A read-only direction shows MobilePrototypeReadOnlySheet instead.
 */
export function MobilePrototypePinSheet({
  pin,
  state,
  update,
  tab,
  onTab,
  pulseField,
  pulseNonce
}: {
  pin: PrototypePin
  state: PrototypeSetState
  update: Update
  tab: MobilePrototypePinTab
  onTab: (tab: MobilePrototypePinTab) => void
  /** The control a draft item jumped to, while this pin is the one it jumped to. */
  pulseField: PrototypeDraftField | null
  pulseNonce: number
}) {
  const { height: screenHeight } = useWindowDimensions()
  const scroll = useRef<ScrollView>(null)
  const rowY = useRef(new Map<PrototypeDraftField, number>())
  const showEdit = tab === 'edit'
  const pulse: MobilePrototypePulseTarget = {
    field: pulseField,
    nonce: pulseNonce,
    onRowLayout: (field, event) => {
      rowY.current.set(field, event.nativeEvent.layout.y)
    }
  }
  useEffect(() => {
    const y = pulseField === null ? undefined : rowY.current.get(pulseField)
    if (y !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true })
    }
  }, [pulseField, pulseNonce])
  const onNoteLayout = (event: LayoutChangeEvent): void => {
    rowY.current.set('note', event.nativeEvent.layout.y)
  }

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
      <MobilePrototypeSheetTabs
        tabs={[
          {
            key: 'edit',
            label: `Edit · ${selectedPinEditCount(state)}`,
            selected: showEdit,
            onPress: () => onTab('edit')
          },
          { key: 'note', label: 'Note', selected: !showEdit, onPress: () => onTab('note') }
        ]}
      />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: screenHeight * SHEET_MAX_HEIGHT_SHARE }}
        contentContainerStyle={styles.body}
      >
        {showEdit ? (
          <MobilePrototypeEditFields pin={pin} state={state} update={update} pulse={pulse} />
        ) : (
          <MobilePrototypePulse
            ring={pulseField === 'note'}
            nonce={pulseNonce}
            onLayout={onNoteLayout}
          >
            <View style={styles.note}>
              <Text style={styles.noteLabel}>{NOTE_LABEL}</Text>
              <TextInput
                accessibilityLabel={NOTE_LABEL}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder={NOTE_PLACEHOLDER}
                placeholderTextColor={colors.textSecondary}
                value={noteFor(state)}
                onChangeText={(text) => update((latest) => setNote(latest, text))}
                style={styles.noteInput}
              />
              <View style={styles.chips}>
                {NOTE_EXAMPLE_CHIPS.map((chip) => (
                  <Pressable
                    key={chip}
                    accessibilityRole="button"
                    hitSlop={4}
                    onPress={() =>
                      update((latest) => setNote(latest, noteFromExampleChip(chip, pin.label)))
                    }
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{chip}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </MobilePrototypePulse>
        )}
        <Text style={styles.footer}>
          Every change and note joins the draft on its own. Put a value back to remove it.
        </Text>
      </ScrollView>
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
  body: { gap: spacing.md },
  note: { gap: 8, padding: 2 },
  noteLabel: { color: colors.textSecondary, fontSize: 13 },
  noteInput: {
    minHeight: 84,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  footer: { color: colors.textSecondary, fontSize: typography.metaSize }
})
