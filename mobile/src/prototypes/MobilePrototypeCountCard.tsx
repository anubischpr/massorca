import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PROTOTYPE_CARD_COUNT_CHOICES } from '../../../src/shared/prototype-count-setting'
import type { NativeChatPrototypeChoice } from '../../../src/shared/prototype-request-decision'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { MobilePrototypeAsk } from './mobile-prototype-ask-store'

/** Asks how many prototypes before a message that asks for them is sent; docked above the composer. */
export function MobilePrototypeCountCard({
  ask,
  onChoose,
  onOpenSettings
}: {
  /** Only what the card shows, so a surface without a chat draft (the Bot teams room) can render it. */
  ask: Pick<MobilePrototypeAsk, 'agentName' | 'defaultCount' | 'keyword'>
  onChoose: (choice: NativeChatPrototypeChoice) => void
  onOpenSettings: () => void
}) {
  return (
    <View accessibilityRole="none" accessibilityLabel="How many prototypes" style={styles.card}>
      <Text style={styles.title}>How many prototypes?</Text>
      <Text
        style={styles.description}
      >{`${ask.agentName} makes distinct directions so you can compare.`}</Text>
      <View style={styles.choices}>
        {PROTOTYPE_CARD_COUNT_CHOICES.map((count) => {
          const primary = count === ask.defaultCount
          return (
            <Pressable
              key={count}
              accessibilityRole="button"
              accessibilityLabel={String(count)}
              onPress={() => onChoose({ count })}
              style={[styles.choice, primary ? styles.choicePrimary : styles.choiceOutline]}
            >
              <Text style={[styles.choiceText, primary && styles.choiceTextPrimary]}>{count}</Text>
            </Pressable>
          )
        })}
        {ask.keyword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not a prototype"
            onPress={() => onChoose('as-typed')}
            style={[styles.choice, styles.choiceOutline, styles.choiceWide]}
          >
            <Text style={styles.choiceText}>Not a prototype</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Change the default in Settings"
        onPress={onOpenSettings}
        style={styles.link}
      >
        <Text style={styles.linkText}>Change the default in Settings</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: 14,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.bodySize + 1,
    fontWeight: '600'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  choice: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  choiceWide: {
    flex: 2
  },
  choicePrimary: {
    backgroundColor: colors.textPrimary
  },
  choiceOutline: {
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  choiceText: {
    color: colors.textPrimary,
    fontSize: 16
  },
  choiceTextPrimary: {
    color: colors.bgBase,
    fontWeight: '500'
  },
  link: {
    minHeight: 44,
    justifyContent: 'center'
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline'
  }
})
