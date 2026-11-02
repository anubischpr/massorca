import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import type { MergePreviewPlacement } from '../../../src/shared/prototype-merge-preview-document'
import { joinDirectionLetters } from '../../../src/shared/prototype-merge-message'
import {
  chosenSelectorOf,
  keptMergeParts,
  mergeMarkOf,
  type PrototypeMergeMark,
  type PrototypeMergePartKind,
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
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobilePrototypeMergeComposer } from './MobilePrototypeMergeComposer'
import { MobilePrototypeMergePreview } from './MobilePrototypeMergePreview'
import { MobilePrototypeSheetTabs } from './MobilePrototypeSheetTabs'
import { useMobilePrototypeMergePreview } from './use-mobile-prototype-merge-preview'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void
type Review = Extract<PrototypeMergeState, { phase: 'review' }>
type MergeTab = 'parts' | 'preview'

// Mobile has no translation layer; these are the English values of the desktop keys.
function markLabel(mark: PrototypeMergeMark, letter: string): string {
  return mark === 'only in' ? `only in ${letter}` : mark
}

function groupHeading(kind: PrototypeMergePartKind): string {
  return kind === 'component' ? 'Components' : 'Sections'
}

function PartRow({
  part,
  letters,
  placement,
  onToggle,
  onSource
}: {
  part: PrototypeMergeReviewPart
  /** The starred letters this part has, as its possible sources. */
  letters: readonly string[]
  placement: MergePreviewPlacement
  onToggle: () => void
  onSource: (letter: string) => void
}) {
  // Why: a part in one direction has one source, so its letter is shown but cannot change.
  const locked = letters.length === 1
  const mark = mergeMarkOf(part, placement)
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
            {chosenSelectorOf(part)}
          </Text>
        </View>
        <Text style={[styles.mark, mark === 'no preview' && styles.markWarning]}>
          {markLabel(mark, part.from)}
        </Text>
      </Pressable>
      <View accessibilityLabel={`Source of ${part.name}`} style={styles.segment}>
        {letters.map((letter) => (
          <Pressable
            key={letter}
            accessibilityRole="button"
            accessibilityState={{ selected: part.from === letter, disabled: locked }}
            disabled={locked}
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
 * The merge review as a sheet. Parts scrolls every option; Preview shows the composed page and the
 * "Anything else" note. The send sits in a footer under both tabs, so it is always in reach.
 */
export function MobilePrototypeMergeSheet({
  client,
  set,
  review,
  agentName,
  nextLetter,
  sendFailed,
  update,
  onSend
}: {
  client: RpcClient | null
  set: PrototypeListedSet
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
  const preview = useMobilePrototypeMergePreview({
    client,
    set,
    letters: review.letters,
    parts: review.parts
  })
  const groups = (['section', 'component'] as const).map((kind) => ({
    kind,
    parts: review.parts.filter((part) => part.kind === kind)
  }))
  return (
    <View style={styles.sheet}>
      <MobilePrototypeMergeComposer request={preview.request} onResponse={preview.onResponse} />
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
          groups.map((group) =>
            group.parts.length === 0 ? null : (
              <View key={group.kind} style={styles.group}>
                <Text style={styles.groupHeading}>{groupHeading(group.kind)}</Text>
                {group.parts.map((part) => (
                  <PartRow
                    key={part.id}
                    part={part}
                    letters={review.letters.filter(
                      (letter) => part.selectors[letter] !== undefined
                    )}
                    placement={preview.placement[part.id] ?? 'placed'}
                    onToggle={() => update((current) => togglePart(current, part.id))}
                    onSource={(letter) =>
                      update((current) => setPartSource(current, part.id, letter))
                    }
                  />
                ))}
              </View>
            )
          )
        ) : (
          <>
            <MobilePrototypeMergePreview
              name={`${nextLetter} · preview`}
              agentName={agentName}
              html={preview.html}
              failed={preview.failed}
            />
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
  group: { gap: spacing.sm },
  groupHeading: { paddingTop: 4, color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  footer: { gap: spacing.sm },
  part: {
    gap: 6,
    paddingVertical: 6,
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
  markWarning: { color: colors.statusAmber },
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
