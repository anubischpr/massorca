import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native'
import type { PrototypeDraftItem } from '../../../src/shared/prototype-draft'
import { setPrompt, type PrototypeSetState } from '../../../src/shared/prototype-set-state'
import { draftOf, hasNothingToSend } from '../../../src/shared/prototype-set-view'
import { colors, spacing, typography } from '../theme/mobile-theme'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** How far the sheet may grow: a share of the screen, so the frame behind it stays in view. */
const SHEET_MAX_HEIGHT_SHARE = 0.85

/**
 * Everything the next message will carry, grouped by pin, then the free text and Send. Tapping an
 * item jumps to its control.
 */
export function MobilePrototypeDraftSheet({
  agentName,
  state,
  update,
  onClose,
  onJump,
  onSend
}: {
  agentName: string
  state: PrototypeSetState
  update: Update
  onClose: () => void
  onJump: (item: PrototypeDraftItem) => void
  onSend: () => void
}) {
  const { height: screenHeight } = useWindowDimensions()
  const draft = draftOf(state)
  const sendDisabled = state.sending || hasNothingToSend(state)
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{`Draft for ${agentName} · ${draft.itemCount}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: screenHeight * SHEET_MAX_HEIGHT_SHARE }}
        contentContainerStyle={styles.body}
      >
        <Text
          style={styles.hint}
        >{`Iterate on ${state.active}. Tap an item to jump to its control.`}</Text>
        {draft.groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <Pressable
                key={`${item.letter}:${item.pinKey}:${item.field}`}
                accessibilityRole="button"
                onPress={() => onJump(item)}
                style={styles.item}
              >
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemText}>{item.value}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Text style={styles.hint}>Anything else</Text>
        <TextInput
          accessibilityLabel="Anything else"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="Flow, overall direction, anything a note can’t point at…"
          placeholderTextColor={colors.textSecondary}
          value={state.prompt}
          onChangeText={(text) => update((latest) => setPrompt(latest, text))}
          style={styles.prompt}
        />
        {state.sentMessage === null ? null : (
          <View accessibilityRole="summary" style={styles.sent}>
            <Text style={styles.sentText}>
              {`Sent to ${agentName} as one message. The next version shows up here.`}
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={sendDisabled}
          onPress={onSend}
          style={[styles.send, sendDisabled && styles.sendDisabled]}
        >
          <Text style={styles.sendText}>{`Send to ${agentName}`}</Text>
        </Pressable>
        {state.sendFailed ? (
          <Text accessibilityRole="alert" style={styles.failed}>
            Couldn't send: the chat is no longer active. Your draft is kept.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 18 },
  body: { gap: 10 },
  hint: { color: colors.textSecondary, fontSize: 13 },
  group: { gap: 6 },
  groupTitle: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  itemLabel: {
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: 11
  },
  itemText: { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  chevron: { color: colors.textSecondary },
  prompt: {
    minHeight: 84,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  sent: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  sentText: { color: colors.textPrimary, fontSize: 13 },
  send: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.textPrimary
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.bgBase, fontSize: 16, fontWeight: '500' },
  failed: { color: colors.statusRed, fontSize: typography.metaSize }
})
