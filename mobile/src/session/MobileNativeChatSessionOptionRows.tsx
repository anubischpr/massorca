// The pill and choice-row primitives the session-option card is built from, kept
// beside it so the card file stays about layout and apply wiring.

import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  sessionOptionValueMarker,
  type SessionOptionDescriptor,
  type SessionOptionSelectChoice,
  type SessionOptionValueMarker,
  type SessionOptionValue
} from '../../../src/shared/native-chat-session-options'

/** Muted one-liner above a group — dispatch state, or why a row is locked. */
export function SessionOptionCaption({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.caption}>{children}</Text>
}

function ChoiceRow({
  label,
  description,
  leading,
  selected,
  disabled,
  grouped,
  divided,
  labelColor,
  onPress
}: {
  label: string
  description?: string
  leading?: React.ReactNode
  selected: boolean
  disabled: boolean
  grouped: boolean
  divided: boolean
  labelColor?: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[
        styles.row,
        selected && styles.rowSelected,
        grouped && styles.rowGrouped,
        divided && styles.rowDivided,
        disabled && styles.rowDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Check size={12} color={colors.bgBase} strokeWidth={3} /> : null}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
        {description ? (
          <Text style={styles.rowDescription} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function ToggleRow({
  label,
  checked,
  marker,
  disabled,
  grouped,
  onToggle
}: {
  label: string
  checked: boolean
  /** Where the rendered value came from, or null once something picked it. */
  marker: SessionOptionValueMarker | null
  disabled: boolean
  grouped: boolean
  onToggle: (next: boolean) => void
}): React.JSX.Element {
  return (
    <View style={[styles.row, grouped && styles.rowGrouped, disabled && styles.rowDisabled]}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {marker ? (
        <Text style={styles.rowMarker}>{marker === 'default' ? 'Default' : 'Not reported'}</Text>
      ) : null}
      <Switch
        accessibilityLabel={label}
        value={checked}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.bgRaised, true: colors.textSecondary }}
        thumbColor={colors.textPrimary}
      />
    </View>
  )
}

function ActionRow({
  label,
  disabled,
  grouped,
  onPress
}: {
  label: string
  disabled: boolean
  grouped: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.row, grouped && styles.rowGrouped, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
    </Pressable>
  )
}

export function SessionOptionSummaryRow({
  label,
  value,
  disabled,
  divided,
  onPress
}: {
  label: string
  value: string
  disabled: boolean
  divided: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.summaryRow,
        divided && styles.rowDivided,
        pressed && !disabled && styles.pressed,
        disabled && styles.rowDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.2} />
    </Pressable>
  )
}

export function DescriptorRows({
  descriptor,
  disabled,
  grouped = false,
  choiceLabelColor,
  choiceLeading,
  onSetOption,
  onInvokeAction,
  agentPickerNote
}: {
  descriptor: SessionOptionDescriptor
  disabled: boolean
  grouped?: boolean
  /** Tints a choice's label, e.g. full access in the danger colour. */
  choiceLabelColor?: (value: string) => string | undefined
  /** A glyph before each choice's radio: the effort meter level or the access icon. */
  choiceLeading?: (choice: SessionOptionSelectChoice) => React.ReactNode
  onSetOption: (value: SessionOptionValue) => void
  onInvokeAction: () => void
  /** Says where the agent's own picker opens; shown under its action row. */
  agentPickerNote?: string
}): React.JSX.Element {
  const locked = disabled || !descriptor.settable
  // Why: flip-only without a baseline is an action — never claim On/Off.
  if (descriptor.action?.type === 'toggle-command') {
    return (
      <ActionRow
        label={`Toggle ${descriptor.label.toLowerCase()}`}
        disabled={locked}
        grouped={grouped}
        onPress={onInvokeAction}
      />
    )
  }
  // Why: agent-picker opens the TUI; it is not a set of radio choices.
  if (descriptor.action?.type === 'agent-picker') {
    return (
      <>
        <ActionRow
          label="Change in the terminal"
          disabled={locked}
          grouped={grouped}
          onPress={onInvokeAction}
        />
        {agentPickerNote ? <SessionOptionCaption>{agentPickerNote}</SessionOptionCaption> : null}
      </>
    )
  }
  // One switch, not an On/Off pair: the option is binary. The value always
  // renders; the marker is what keeps an unpicked one from reading as confirmed,
  // since the switch itself cannot say "nobody said".
  if (descriptor.kind.type === 'boolean') {
    return (
      <ToggleRow
        label={descriptor.label}
        checked={descriptor.kind.currentValue}
        marker={sessionOptionValueMarker(descriptor)}
        disabled={locked}
        grouped={grouped}
        onToggle={(next) => onSetOption(next)}
      />
    )
  }
  const { currentValue, choices } = descriptor.kind
  return (
    <>
      {choices.map((choice, index) => (
        <ChoiceRow
          key={choice.value}
          label={choice.label}
          description={choice.description}
          leading={choiceLeading?.(choice)}
          selected={choice.value === currentValue}
          disabled={locked || choice.disabled === true}
          grouped={grouped}
          divided={grouped && index < choices.length - 1}
          labelColor={choiceLabelColor?.(choice.value)}
          onPress={() => onSetOption(choice.value)}
        />
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7
  },
  caption: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs
  },
  rowMarker: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xs
  },
  rowSelected: {
    borderColor: colors.statusGreen
  },
  rowGrouped: {
    marginBottom: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  rowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  rowDisabled: {
    opacity: 0.5
  },
  leading: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOn: {
    backgroundColor: colors.statusGreen,
    borderColor: colors.statusGreen
  },
  rowBody: {
    flex: 1,
    gap: 2
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  rowDescription: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  summaryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  summaryLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  summaryValue: {
    maxWidth: 160,
    color: colors.textSecondary,
    fontSize: typography.bodySize
  }
})
