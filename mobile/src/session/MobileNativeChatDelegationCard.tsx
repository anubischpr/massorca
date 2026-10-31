import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DELEGATION_AUTOMATIC_OPTION_ID } from '../../../src/shared/delegated-session-journal'
import {
  defaultDelegationDesignSystemMode,
  delegationDesignSystemModes
} from '../../../src/shared/delegation-prototype-choices'
import type { PrototypeDesignSystemMode } from '../../../src/shared/prototype-design-system-files'
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
  /** Sends the chosen option's answer text, with the count and design system choice the card shows. */
  onAnswer: (
    text: string,
    count?: number,
    designSystem?: PrototypeDesignSystemMode
  ) => Promise<boolean>
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
  const prototypeCount = card.prototypeCount
  const designSystem = card.designSystem
  // Why: a row the question carries no answer for cannot be sent, so the card does not offer it.
  const rows = delegationOptionRows(card).filter((row) => answerTokens[row.optionId] !== undefined)
  const [picked, setPicked] = useState<string | null>(null)
  const [pickedCount, setPickedCount] = useState<number | null>(null)
  const [pickedSystem, setPickedSystem] = useState<PrototypeDesignSystemMode | null>(null)
  const shownCount = prototypeCount ? (pickedCount ?? prototypeCount.defaultCount) : undefined
  const shownSystem = designSystem
    ? (pickedSystem ?? defaultDelegationDesignSystemMode(designSystem))
    : undefined
  // Why: the default follows the card until the person picks, and a choice never sits on a row the card no longer draws.
  const drawn = (optionId: string | null): string | null =>
    rows.some((row) => row.optionId === optionId) ? optionId : null
  const selectedId = drawn(picked) ?? drawn(defaultDelegationOption(card))
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
      // Why: a group the card draws sends what it shows highlighted, so the answer is what the person saw;
      // a card without the group (an older host) sends nothing and the host keeps its defaults.
      if (shownCount === undefined && shownSystem === undefined) {
        await onAnswer(token)
      } else {
        await onAnswer(token, shownCount, shownSystem)
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <View style={styles.card} accessibilityLabel={question} accessibilityState={{ busy: sending }}>
      <Text style={styles.question}>{question}</Text>
      {/* Why: the count group takes room back from the agent rows, so the explanation and Start stay on screen. */}
      <ScrollView
        style={[styles.rows, prototypeCount || designSystem ? styles.rowsWithCount : undefined]}
        keyboardShouldPersistTaps="always"
      >
        {rows.map((row) => (
          <OptionRow
            key={row.optionId}
            row={row}
            selected={row.optionId === selectedId}
            disabled={sending}
            onPress={() => setPicked(row.optionId)}
          />
        ))}
      </ScrollView>

      {prototypeCount ? (
        <View
          style={styles.countGroup}
          accessibilityRole="radiogroup"
          accessibilityLabel="How many prototypes?"
        >
          <Text style={styles.countTitle}>How many prototypes?</Text>
          <View style={styles.countChoices}>
            {prototypeCount.choices.map((count) => {
              const highlighted = count === shownCount
              return (
                <Pressable
                  key={count}
                  accessibilityRole="radio"
                  accessibilityLabel={String(count)}
                  accessibilityState={{ checked: highlighted, disabled: sending }}
                  disabled={sending}
                  style={({ pressed }) => [
                    styles.countChoice,
                    highlighted ? styles.countChoicePrimary : styles.countChoiceOutline,
                    pressed && styles.pressed
                  ]}
                  onPress={() => setPickedCount(count)}
                >
                  <Text
                    style={[styles.countChoiceText, highlighted && styles.countChoiceTextPrimary]}
                  >
                    {count}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      {designSystem && shownSystem ? (
        <View
          style={styles.countGroup}
          accessibilityRole="radiogroup"
          accessibilityLabel={designSystemTitle(designSystem)}
        >
          <Text style={styles.countTitle}>{designSystemTitle(designSystem)}</Text>
          {designSystem.kind === 'existing' ? (
            <Text style={styles.detail}>
              {`v${designSystem.version} · ${designSystem.tokenCount} tokens`}
            </Text>
          ) : null}
          <View style={styles.countChoices}>
            {delegationDesignSystemModes(designSystem).map((mode) => {
              const highlighted = mode === shownSystem
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityLabel={designSystemModeLabel(mode)}
                  accessibilityState={{ checked: highlighted, disabled: sending }}
                  disabled={sending}
                  style={({ pressed }) => [
                    styles.countChoice,
                    highlighted ? styles.countChoicePrimary : styles.countChoiceOutline,
                    pressed && styles.pressed
                  ]}
                  onPress={() => setPickedSystem(mode)}
                >
                  <Text
                    style={[styles.countChoiceText, highlighted && styles.countChoiceTextPrimary]}
                  >
                    {designSystemModeLabel(mode)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

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

// The direct prototype request card's words for the same choices and title.
function designSystemTitle(
  card: NonNullable<MobileDelegationQuestion['card']['designSystem']>
): string {
  return card.kind === 'existing'
    ? `Design system · ${card.projectName}`
    : `No design system in ${card.projectName}`
}

function designSystemModeLabel(mode: PrototypeDesignSystemMode): string {
  switch (mode) {
    case 'use':
      return 'Use it'
    case 'propose':
      return 'Propose one first'
    case 'skip':
      return 'Skip'
  }
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
  rowsWithCount: {
    maxHeight: 200
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
  countGroup: {
    gap: spacing.xs
  },
  countTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  countChoices: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  countChoice: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button
  },
  countChoicePrimary: {
    backgroundColor: colors.textPrimary
  },
  countChoiceOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  countChoiceText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  countChoiceTextPrimary: {
    color: colors.bgBase
  },
  pressed: {
    opacity: 0.7
  }
})
