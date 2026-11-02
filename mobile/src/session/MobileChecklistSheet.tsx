import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import type { NativeChatChecklist, NativeChatChecklistItem } from '../../../src/shared/native-chat-checklist'
import { BottomDrawer } from '../components/BottomDrawer'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  mobileNativeChatChecklistItemMeta,
  mobileNativeChatChecklistSourceLine,
  mobileNativeChatChecklistUnseenText
} from './mobile-native-chat-checklist-model'

type SheetProps = {
  visible: boolean
  checklist: NativeChatChecklist | null
  /** When the agent last wrote the checklist. */
  writtenAt: number | null
  agentLabel: string
  readOnly: boolean
  onClose: () => void
  /** Ticks or unticks one item, which saves on the host. */
  onToggle: (item: NativeChatChecklistItem) => void
  onOpenItem: (key: string) => void
  onSendNow: () => void
}

/** The chat's checklist: the person's and the agent's ticks, with progress and the changes not yet sent. */
export function MobileChecklistSheet({
  visible,
  checklist,
  writtenAt,
  agentLabel,
  readOnly,
  onClose,
  onToggle,
  onOpenItem,
  onSendNow
}: SheetProps): React.JSX.Element {
  const items = checklist?.items ?? []
  const total = items.length
  const checked = checklist?.checked ?? 0
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0
  const unseen = checklist?.unseen ?? 0
  return (
    <BottomDrawer visible={visible} onClose={onClose} dragContentToDismiss contentScrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Checklist</Text>
        <Text style={styles.count}>{`${checked} of ${total} checked`}</Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: checked }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      {checklist ? (
        <Text style={styles.source}>
          {mobileNativeChatChecklistSourceLine({
            title: checklist.title,
            agentLabel,
            at: writtenAt
          })}
        </Text>
      ) : null}
      <SheetSectionLabel label="Items" count={total} />
      <View style={styles.group}>
        {items.map((item, index) => (
          <View key={item.key}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <MobileChecklistItemRow
              item={item}
              agentLabel={agentLabel}
              readOnly={readOnly}
              onToggle={onToggle}
              onOpen={onOpenItem}
            />
          </View>
        ))}
      </View>
      {unseen > 0 ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{mobileNativeChatChecklistUnseenText(unseen)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send now"
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            onPress={onSendNow}
          >
            <Text style={styles.sendText}>Send now</Text>
          </Pressable>
        </View>
      ) : null}
      {readOnly ? (
        <Text style={styles.readOnly}>Update the host to check items here.</Text>
      ) : null}
    </BottomDrawer>
  )
}

type RowProps = {
  item: NativeChatChecklistItem
  agentLabel: string
  readOnly: boolean
  onToggle: (item: NativeChatChecklistItem) => void
  onOpen: (key: string) => void
}

/** One item: its checkbox ticks it in place; the rest of the row opens the item sheet. */
export function MobileChecklistItemRow({ item, agentLabel, readOnly, onToggle, onOpen }: RowProps) {
  const meta = mobileNativeChatChecklistItemMeta(item, agentLabel)
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.text}
        accessibilityState={{ checked: item.checked, disabled: readOnly }}
        disabled={readOnly}
        style={styles.checkHit}
        onPress={() => onToggle(item)}
      >
        <View style={[styles.box, item.checked && styles.boxChecked]}>
          {item.checked ? <Check size={12} color={colors.onAccent} strokeWidth={3} /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.text}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        onPress={() => onOpen(item.key)}
      >
        <Text style={[styles.text, item.checked && styles.textChecked]} numberOfLines={3}>
          {item.text}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {item.note ? (
          <View style={styles.note}>
            <Text style={styles.noteText} numberOfLines={3}>
              {item.note}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.1} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600'
  },
  count: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  track: {
    height: 6,
    marginTop: spacing.sm,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.bgRaised
  },
  fill: {
    height: 6,
    backgroundColor: colors.statusGreen
  },
  source: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  group: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.md
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.md
  },
  checkHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  box: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted
  },
  boxChecked: {
    borderColor: colors.statusGreen,
    backgroundColor: colors.statusGreen
  },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  text: {
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  textChecked: {
    color: colors.textSecondary
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  note: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.input,
    backgroundColor: colors.bgRaised
  },
  noteText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  footer: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  sendButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.accentBlue
  },
  sendText: {
    color: colors.onAccent,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  readOnly: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
