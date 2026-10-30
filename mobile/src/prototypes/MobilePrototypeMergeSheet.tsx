import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { joinDirectionLetters } from '../../../src/shared/prototype-merge-message'
import {
  keptMergeParts,
  mergeMarkOf,
  type PrototypeMergeReviewPart,
  type PrototypeMergeState
} from '../../../src/shared/prototype-merge-plan'
import {
  cancelMerge,
  setMergeNote,
  setPartSource,
  togglePart
} from '../../../src/shared/prototype-merge-state'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { MobilePrototypeSheetTabs } from './MobilePrototypeSheetTabs'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void
type Review = Extract<PrototypeMergeState, { phase: 'review' }>
type MergeTab = 'parts' | 'preview'

function PartRow({
  part,
  letters,
  onToggle,
  onSource
}: {
  part: PrototypeMergeReviewPart
  letters: readonly string[]
  onToggle: () => void
  onSource: (letter: string) => void
}) {
  return (
    <View style={[styles.part, !part.on && styles.partOff]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={part.name}
        accessibilityState={{ checked: part.on }}
        onPress={onToggle}
        style={styles.partHead}
      >
        <View style={[styles.box, part.on && styles.boxOn]}>
          {part.on ? <Check size={14} color={colors.bgBase} strokeWidth={3} /> : null}
        </View>
        <View style={styles.partText}>
          <Text style={styles.partName}>{part.name}</Text>
          <Text style={styles.partSelector} numberOfLines={1}>
            {part.selector}
          </Text>
        </View>
        <Text style={styles.mark}>{mergeMarkOf(part)}</Text>
      </Pressable>
      <View accessibilityLabel={`Source of ${part.name}`} style={styles.segment}>
        {letters.map((letter) => (
          <Pressable
            key={letter}
            accessibilityRole="button"
            accessibilityState={{ selected: part.from === letter }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onSource(letter)}
            style={[styles.source, part.from === letter && styles.sourceOn]}
          >
            <Text style={[styles.sourceText, part.from === letter && styles.sourceTextOn]}>
              {letter}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/**
 * The merge review as a sheet. Parts scrolls every option; Preview lists the planned direction and
 * the "Anything else" note. The send sits in a footer under both tabs, so it is always in reach.
 */
export function MobilePrototypeMergeSheet({
  review,
  agentName,
  nextLetter,
  sendFailed,
  update,
  onSend
}: {
  review: Review
  agentName: string
  /** The letter the merged direction takes. */
  nextLetter: string
  sendFailed: boolean
  update: Update
  onSend: () => void
}) {
  const [tab, setTab] = useState<MergeTab>('parts')
  const kept = keptMergeParts(review.parts)
  const sendDisabled = review.sending || kept.length === 0
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{`Merge ${joinDirectionLetters(review.letters)}`}</Text>
          <Text style={styles.subtitle}>
            {`${agentName} suggested a source for each part. Change any of them, or leave a part out.`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => update(cancelMerge)}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <MobilePrototypeSheetTabs
        tabs={[
          {
            key: 'parts',
            label: 'Parts',
            selected: tab === 'parts',
            onPress: () => setTab('parts')
          },
          {
            key: 'preview',
            label: 'Preview',
            selected: tab === 'preview',
            onPress: () => setTab('preview')
          }
        ]}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.body}
      >
        {tab === 'parts' ? (
          review.parts.map((part, index) => (
            <PartRow
              key={part.id}
              part={part}
              letters={review.letters}
              onToggle={() => update((current) => togglePart(current, index))}
              onSource={(letter) => update((current) => setPartSource(current, index, letter))}
            />
          ))
        ) : (
          <>
            <View style={styles.preview}>
              {kept.map((part) => (
                <View key={part.id} style={styles.previewRow}>
                  <View
                    accessibilityRole="image"
                    accessibilityLabel={part.name}
                    style={styles.previewLetter}
                  >
                    <Text style={styles.previewLetterText}>{part.from}</Text>
                  </View>
                  <View style={styles.previewText}>
                    <Text style={styles.previewName}>{part.name}</Text>
                    <Text style={styles.previewSelector} numberOfLines={1}>
                      {part.selector}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.label}>Anything else</Text>
            <TextInput
              accessibilityLabel="Anything else"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              placeholder="How the parts should fit together…"
              placeholderTextColor={colors.textSecondary}
              value={review.note}
              onChangeText={(text) => update((current) => setMergeNote(current, text))}
              style={styles.note}
            />
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={sendDisabled}
          onPress={onSend}
          style={[styles.send, sendDisabled && styles.sendDisabled]}
        >
          <Text style={styles.sendText}>{`Merge into ${nextLetter}`}</Text>
        </Pressable>
        {sendFailed ? (
          <Text accessibilityRole="alert" style={styles.failed}>
            Couldn't send: the chat is no longer active. Your draft is kept.
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    flexShrink: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 18 },
  // Why: the list takes what the drawer leaves and scrolls, so no option is ever cut off.
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  body: { gap: spacing.md },
  footer: { gap: spacing.sm },
  part: {
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  partOff: { opacity: 0.45 },
  partHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  partText: { flex: 1, minWidth: 0 },
  partName: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  partSelector: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  mark: { color: colors.textSecondary, fontSize: typography.metaSize },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  source: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  sourceOn: { backgroundColor: colors.statusAmber },
  sourceText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  sourceTextOn: { color: colors.bgBase },
  preview: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surfaceBright
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewLetter: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.bgBase
  },
  previewLetterText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  previewText: { flex: 1, minWidth: 0 },
  previewName: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  previewSelector: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  label: { color: colors.textSecondary, fontSize: 13 },
  note: {
    minHeight: 64,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  send: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.textPrimary
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.bgBase, fontSize: 15, fontWeight: '500' },
  failed: { color: colors.statusRed, fontSize: typography.metaSize }
})
