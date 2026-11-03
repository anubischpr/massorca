import { Fragment } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { SlashCommandSuggestion } from '../../../src/shared/native-chat-slash-commands'

/** One row of the composer autocomplete: an agent slash command (with its
 *  catalog description, desktop parity) or a worktree file path. */
export type ComposerSuggestion =
  | { kind: 'command'; command: SlashCommandSuggestion }
  | { kind: 'file'; path: string }
  /** A row the screen supplies, such as a Bot teams mention. */
  | {
      kind: 'custom'
      key: string
      insert: string
      label: string
      detail?: string
      icon?: React.ReactNode
      /** A heading drawn above the first row of each group. */
      group?: string
    }

function suggestionGroup(suggestion: ComposerSuggestion | undefined): string | undefined {
  return suggestion?.kind === 'custom' ? suggestion.group : undefined
}

export function composerSuggestionKey(suggestion: ComposerSuggestion): string {
  if (suggestion.kind === 'custom') {
    return `custom:${suggestion.key}`
  }
  return suggestion.kind === 'command'
    ? `command:${suggestion.command.name}`
    : `file:${suggestion.path}`
}

/** The text the suggestion inserts at the trigger span. */
export function composerSuggestionInsertText(suggestion: ComposerSuggestion): string {
  if (suggestion.kind === 'custom') {
    return suggestion.insert
  }
  return suggestion.kind === 'command' ? `/${suggestion.command.name}` : `@${suggestion.path}`
}

export function MobileNativeChatComposerSuggestions({
  suggestions,
  onPick
}: {
  suggestions: readonly ComposerSuggestion[]
  onPick: (suggestion: ComposerSuggestion) => void
}): React.JSX.Element {
  return (
    <View style={styles.suggestions}>
      <ScrollView keyboardShouldPersistTaps="always" style={styles.suggestionScroll}>
        {suggestions.map((suggestion, index) => {
          const group = suggestionGroup(suggestion)
          const heading = group && group !== suggestionGroup(suggestions[index - 1]) ? group : null
          return (
            <Fragment key={composerSuggestionKey(suggestion)}>
              {heading ? (
                <Text style={styles.groupHeading} accessibilityRole="header">
                  {heading}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                onPress={() => onPick(suggestion)}
              >
                {suggestion.kind === 'custom' ? (
                  <View style={styles.customRow}>
                    {suggestion.icon}
                    <Text style={styles.customLabel} numberOfLines={1}>
                      {suggestion.label}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {composerSuggestionInsertText(suggestion)}
                  </Text>
                )}
                {suggestion.kind === 'custom' && suggestion.detail ? (
                  <Text style={styles.suggestionDescription} numberOfLines={1}>
                    {suggestion.detail}
                  </Text>
                ) : null}
                {suggestion.kind === 'command' && suggestion.command.description ? (
                  <Text style={styles.suggestionDescription} numberOfLines={1}>
                    {suggestion.command.description}
                  </Text>
                ) : null}
              </Pressable>
            </Fragment>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  suggestions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  suggestionScroll: {
    maxHeight: 220
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    gap: 1
  },
  // The section heading the account and history screens use.
  groupHeading: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  suggestionPressed: {
    backgroundColor: colors.bgRaised
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  customLabel: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    flexShrink: 1
  },
  suggestionText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  suggestionDescription: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  }
})
