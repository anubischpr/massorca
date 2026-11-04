import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native'
import { Check } from 'lucide-react-native'
import { keyedEntries } from '../../../src/shared/prototype-entry-keys'
import { designSystemDraftGroups } from '../../../src/shared/prototype-design-system-draft'
import { prototypeTitle } from '../../../src/shared/prototype-list-model'
import { removeDraftImage } from '../../../src/shared/prototype-design-system-view-state'
import { colors, spacing, typography } from '../theme/mobile-theme'
import {
  mobileDesignSystemDraftCount,
  mobileDesignSystemNothingToSend
} from './mobile-prototype-design-system-send'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'
import { MobilePrototypeDesignSystemImages } from './MobilePrototypeDesignSystemImages'

/** How far the sheet may grow: a share of the screen, so the screen behind it stays in view. */
const SHEET_MAX_HEIGHT_SHARE = 0.85

/**
 * Everything the next message will carry: the token and component changes, the rebuild option when sets are
 * built on this version, "Anything else" and Send.
 */
export function MobilePrototypeDesignSystemDraftSheet({
  system,
  content,
  state,
  update,
  target,
  rebuildSets,
  images,
  agentName,
  onClose,
  onSend
}: Pick<
  MobileDesignSystemPanelProps,
  'system' | 'content' | 'state' | 'update' | 'target' | 'rebuildSets' | 'images'
> & {
  agentName: string
  onClose: () => void
  onSend: () => void
}) {
  const { height: screenHeight } = useWindowDimensions()
  const groups = designSystemDraftGroups(
    { tokens: content.tokens, components: content.components },
    state.draft
  )
  const titles = rebuildSets.map((set) => prototypeTitle(set)).join(', ')
  const sendDisabled =
    state.sending ||
    images.attaching ||
    target === undefined ||
    mobileDesignSystemNothingToSend({ content, state })
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {`Draft for ${agentName} · ${mobileDesignSystemDraftCount({ content, state })}`}
        </Text>
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
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {keyedEntries(group.items, (item) => `${item.label}:${item.text}`).map(
              ({ key, entry: item }) => (
                <View key={key} style={styles.item}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemText}>{item.text}</Text>
                </View>
              )
            )}
          </View>
        ))}
        {rebuildSets.length === 0 ? null : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: state.rebuild }}
            onPress={() => update((latest) => ({ ...latest, rebuild: !latest.rebuild }))}
            style={styles.rebuild}
          >
            <View style={[styles.box, state.rebuild && styles.boxOn]}>
              {state.rebuild ? <Check size={14} color={colors.bgBase} strokeWidth={3} /> : null}
            </View>
            <Text style={styles.rebuildText}>
              {`Also rebuild the sets built on v${system.version} (${titles}) with the new tokens and components`}
            </Text>
          </Pressable>
        )}
        <Text style={styles.hint}>Anything else</Text>
        <TextInput
          accessibilityLabel="Anything else"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="Tone, brand direction, anything a token can’t express…"
          placeholderTextColor={colors.textSecondary}
          value={state.freeText}
          onChangeText={(text) => update((latest) => ({ ...latest, freeText: text }))}
          style={styles.prompt}
        />
        <MobilePrototypeDesignSystemImages
          images={state.images}
          control={images}
          onRemove={(id) => update((latest) => removeDraftImage(latest, id))}
        />
        <Pressable
          accessibilityRole="button"
          disabled={sendDisabled}
          onPress={onSend}
          style={[styles.send, sendDisabled && styles.sendDisabled]}
        >
          <Text style={styles.sendText}>{`Send to ${agentName}`}</Text>
        </Pressable>
        {state.failed === 'draft' ? (
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
  rebuild: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  boxOn: { borderColor: colors.textPrimary, backgroundColor: colors.textPrimary },
  rebuildText: { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
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
