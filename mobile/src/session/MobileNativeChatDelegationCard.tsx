import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DELEGATION_AUTOMATIC_OPTION_ID } from '../../../src/shared/delegated-session-journal'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  automaticPickText,
  defaultDelegationOption,
  delegationOptionRows,
  type MobileDelegationOptionRow,
  type MobileDelegationQuestion
} from './mobile-delegation-card-model'
import { MobileNativeChatDelegationWhySheet } from './MobileNativeChatDelegationWhySheet'

type Props = {
  /** The question's own text, which heads the card. */
  question: string
  delegation: MobileDelegationQuestion
  /** Sends the answer text of the chosen option through the ordinary structured answer path. */
  onAnswer: (text: string) => Promise<boolean>
  onCancel?: () => Promise<boolean>
}

/** The host's agent-choice card for a delegated session: each agent with its usage, Automatic's pick
 *  with a "why" sheet, and one Start that answers the question. */
export function MobileNativeChatDelegationCard({
  question,
  delegation,
  onAnswer,
  onCancel
}: Props): React.JSX.Element {
  const { card, answerTokens } = delegation
  const decision = card.decision
  // Why: a row the question carries no answer for cannot be sent, so the card does not offer it.
  const rows = delegationOptionRows(card).filter((row) => answerTokens[row.optionId] !== undefined)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // Why: the default is only chosen when its row is drawn, so no pick sits on a row the card hides.
    const fallback = defaultDelegationOption(card)
    return rows.some((row) => row.optionId === fallback) ? fallback : null
  })
  const [sending, setSending] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const sendingRef = useRef(false)
  const token = selectedId === null ? undefined : answerTokens[selectedId]
  const canStart = token !== undefined && !sending

  const start = async (): Promise<void> => {
    if (sendingRef.current || token === undefined) {
      return
    }
    sendingRef.current = true
    setSending(true)
    try {
      await onAnswer(token)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <View style={styles.card} accessibilityLabel={question} accessibilityState={{ busy: sending }}>
      <Text style={styles.question}>{question}</Text>
      <ScrollView style={styles.rows} keyboardShouldPersistTaps="always">
        {rows.map((row) => (
          <OptionRow
            key={row.optionId}
            row={row}
            selected={row.optionId === selectedId}
            disabled={sending}
            onPress={() => setSelectedId(row.optionId)}
          />
        ))}
      </ScrollView>

      {decision && selectedId === DELEGATION_AUTOMATIC_OPTION_ID ? (
        <View style={styles.pick}>
          <Text style={styles.pickText} numberOfLines={2}>
            {automaticPickText(card, decision)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Why Automatic picked this agent"
            hitSlop={spacing.sm}
            style={styles.whyButton}
            onPress={() => setWhyOpen(true)}
          >
            <Text style={styles.whyText}>Why?</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={sending}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={() => void onCancel()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start child session"
          disabled={!canStart}
          style={({ pressed }) => [
            styles.start,
            !canStart && styles.startDisabled,
            pressed && canStart && styles.pressed
          ]}
          onPress={() => void start()}
        >
          <Text style={[styles.startText, !canStart && styles.startTextDisabled]}>
            {sending ? 'Starting…' : 'Start child session'}
          </Text>
        </Pressable>
      </View>

      {decision ? (
        <MobileNativeChatDelegationWhySheet
          visible={whyOpen}
          onClose={() => setWhyOpen(false)}
          card={card}
          decision={decision}
        />
      ) : null}
    </View>
  )
}

function OptionRow({
  row,
  selected,
  disabled,
  onPress
}: {
  row: MobileDelegationOptionRow
  selected: boolean
  disabled: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={row.label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <View style={[styles.radio, selected && styles.radioOn]} />
      <View style={styles.optionBody}>
        <View style={styles.optionHead}>
          <Text style={styles.optionLabel} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={[styles.usage, row.excluded && styles.usageExcluded]} numberOfLines={1}>
            {row.usageText}
          </Text>
        </View>
        {row.barPercent === null ? null : (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${row.barPercent}%` }]} />
          </View>
        )}
        <Text style={styles.detail} numberOfLines={1}>
          {row.detail}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgPanel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  question: {
    color: colors.textPrimary,
    fontSize: typography.bodySize + 1,
    fontWeight: '600'
  },
  rows: {
    flexGrow: 0,
    maxHeight: 300
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xs
  },
  optionSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.bgRaised
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textMuted
  },
  radioOn: {
    borderWidth: 6,
    borderColor: colors.accentBlue
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  optionLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  usage: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  usageExcluded: {
    color: colors.statusRed
  },
  bar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.bgRaised
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accentBlue
  },
  detail: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    minHeight: 44
  },
  pickText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  whyButton: {
    minHeight: 44,
    justifyContent: 'center'
  },
  whyText: {
    color: colors.accentBlue,
    fontSize: typography.bodySize
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  cancel: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  cancelText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  start: {
    flex: 2,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.textPrimary
  },
  startDisabled: {
    backgroundColor: colors.bgRaised
  },
  startText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  startTextDisabled: {
    color: colors.textMuted
  },
  pressed: {
    opacity: 0.7
  }
})
