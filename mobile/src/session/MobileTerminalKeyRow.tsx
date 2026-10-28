import { Pressable, ScrollView, Text, View } from 'react-native'
import { Plus, X } from 'lucide-react-native'
import type { CustomKey } from '../components/CustomKeyModal'
import { triggerMediumImpact } from '../platform/haptics'
import {
  formatTerminalKeyChordLabel,
  terminalKeyChordKeyLabel,
  terminalKeyChordModifierLabel,
  TERMINAL_KEY_CHORD_KEYS,
  TERMINAL_KEY_CHORD_MODIFIERS,
  type TerminalKeyChordKeyId,
  type TerminalKeyChordModifier
} from '../terminal/terminal-key-chord'
import {
  terminalKeyChordModifierOrder,
  terminalKeyChordParts,
  type TerminalKeyChordMainKey,
  type TerminalKeyChordState,
  type TerminalKeyChordStatus
} from '../terminal/terminal-key-chord-state'
import { colors, spacing } from '../theme/mobile-theme'
import { terminalComposerStyles as styles } from './mobile-terminal-composer-styles'

// Why: screen readers should say "Arrow up", not the glyph.
const KEY_SPOKEN_NAMES: Record<TerminalKeyChordKeyId, string> = {
  escape: 'Escape',
  tab: 'Tab',
  enter: 'Enter',
  arrowUp: 'Arrow up',
  arrowDown: 'Arrow down',
  arrowLeft: 'Arrow left',
  arrowRight: 'Arrow right',
  c: 'C',
  d: 'D',
  z: 'Z',
  l: 'L'
}

type MobileTerminalKeyRowProps = {
  readonly chord: TerminalKeyChordState
  readonly status: TerminalKeyChordStatus
  readonly sentLabel: string | null
  readonly showChordBar: boolean
  readonly customKeys: readonly CustomKey[]
  readonly disabled: boolean
  readonly onToggleModifier: (modifier: TerminalKeyChordModifier) => void
  readonly onSelectKey: (mainKey: TerminalKeyChordMainKey) => void
  readonly onClear: () => void
  readonly onSend: () => void
  readonly onAddShortcut: () => void
  readonly onDeleteShortcut: (key: CustomKey) => void
}

/** The chord preview above the keys, and the key row: modifiers with order badges, then main keys. */
export function MobileTerminalKeyRow({
  chord,
  status,
  sentLabel,
  showChordBar,
  customKeys,
  disabled,
  onToggleModifier,
  onSelectKey,
  onClear,
  onSend,
  onAddShortcut,
  onDeleteShortcut
}: MobileTerminalKeyRowProps) {
  return (
    <>
      {showChordBar ? (
        <ChordBar
          chord={chord}
          status={status}
          sentLabel={sentLabel}
          disabled={disabled}
          onClear={onClear}
          onSend={onSend}
        />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={styles.keyRow}
        contentContainerStyle={styles.keyRowContent}
      >
        {TERMINAL_KEY_CHORD_MODIFIERS.map(({ id, label }) => {
          const order = terminalKeyChordModifierOrder(chord, id)
          const selected = order !== null
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={
                selected
                  ? `Remove ${label} from the combination`
                  : `Add ${label} to the combination`
              }
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onToggleModifier(id)}
              style={({ pressed }) => [
                styles.key,
                styles.keyModifier,
                selected && styles.keyOn,
                disabled && styles.disabled,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.keyText, selected && styles.keyTextOn]}>{label}</Text>
              {order !== null ? (
                <View style={styles.keyBadge}>
                  <Text style={styles.keyBadgeText}>{order}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
        {TERMINAL_KEY_CHORD_KEYS.map(({ id, label }) => {
          const selected = chord.mainKey?.kind === 'key' && chord.mainKey.id === id
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${KEY_SPOKEN_NAMES[id]}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelectKey({ kind: 'key', id })}
              style={({ pressed }) => [
                styles.key,
                selected && styles.keyOn,
                disabled && styles.disabled,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.keyText, selected && styles.keyTextOn]}>{label}</Text>
            </Pressable>
          )
        })}
        {customKeys.map((key) => {
          const selected = chord.mainKey?.kind === 'shortcut' && chord.mainKey.id === key.id
          return (
            <Pressable
              key={key.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${key.label}`}
              accessibilityHint="Hold to delete this shortcut"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() =>
                onSelectKey({ kind: 'shortcut', id: key.id, label: key.label, bytes: key.bytes })
              }
              onLongPress={() => {
                triggerMediumImpact()
                onDeleteShortcut(key)
              }}
              delayLongPress={400}
              style={({ pressed }) => [
                styles.key,
                selected && styles.keyOn,
                disabled && styles.disabled,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.keyText, selected && styles.keyTextOn]}>{key.label}</Text>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add custom shortcut"
          onPress={onAddShortcut}
          style={({ pressed }) => [styles.addKey, pressed && styles.pressed]}
        >
          <Plus size={14} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </ScrollView>
    </>
  )
}

function ChordBar({
  chord,
  status,
  sentLabel,
  disabled,
  onClear,
  onSend
}: {
  chord: TerminalKeyChordState
  status: TerminalKeyChordStatus
  sentLabel: string | null
  disabled: boolean
  onClear: () => void
  onSend: () => void
}) {
  const building = status !== 'idle'
  const sendable = status === 'ready' && !disabled
  const hint =
    status === 'needs-key'
      ? 'Now tap a key'
      : status === 'blocked'
        ? 'Saved shortcuts take no modifiers'
        : null
  return (
    <View style={[styles.chordBar, building && styles.chordBarBuilding]}>
      {building ? (
        <View style={styles.chordParts}>
          {chord.modifiers.map((modifier, index) => (
            <ChordPart
              key={modifier}
              label={terminalKeyChordModifierLabel(modifier)}
              separated={index > 0}
            />
          ))}
          {chord.mainKey === null ? null : (
            <ChordPart
              key="main"
              label={mainKeyLabel(chord.mainKey)}
              separated={chord.modifiers.length > 0}
            />
          )}
          {hint !== null ? <Text style={styles.chordHint}>{hint}</Text> : null}
        </View>
      ) : (
        <Text numberOfLines={1} style={[sentLabel !== null ? styles.chordSent : styles.chordHint]}>
          {sentLabel !== null ? `Sent ${sentLabel}` : 'Tap keys to build a combination'}
        </Text>
      )}
      {building ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear keys"
            hitSlop={spacing.xs}
            onPress={onClear}
            style={styles.chordIconButton}
          >
            <X size={12} color={colors.textSecondary} strokeWidth={2.6} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send ${formatTerminalKeyChordLabel(terminalKeyChordParts(chord))}`}
            disabled={!sendable}
            onPress={onSend}
            style={({ pressed }) => [
              styles.chordSend,
              !sendable && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.chordSendText}>Send</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

function ChordPart({ label, separated }: { label: string; separated: boolean }) {
  return (
    <>
      {separated ? <Text style={styles.chordHint}>+</Text> : null}
      <View style={styles.chordPart}>
        <Text style={styles.chordPartText}>{label}</Text>
      </View>
    </>
  )
}

function mainKeyLabel(mainKey: TerminalKeyChordMainKey): string {
  return mainKey.kind === 'key' ? terminalKeyChordKeyLabel(mainKey.id) : mainKey.label
}
