import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { NativeChatTaskList } from '../../../src/shared/native-chat-task-list'
import { MobileChecklistItemRow } from './MobileChecklistSheet'
import { MobileNativeChatChecklistItemSheet } from './MobileNativeChatChecklistSheets'
import { MobilePlanSheet } from './MobilePlanSheet'
import { mobileNativeChatPlanProgress } from './mobile-native-chat-plan'
import type { MobileNativeChatChecklistView } from './use-mobile-native-chat-checklist'

/**
 * The Summary's Plan row and Checklist section, after Environment. Each hides when its source is
 * absent. The Plan opens the existing Plan sheet; an item opens the item sheet, as in the chat.
 */
export function MobileChatSummaryChecklist({
  plan,
  view,
  agentLabel
}: {
  plan: NativeChatTaskList | null
  view: MobileNativeChatChecklistView
  agentLabel: string
}): React.JSX.Element {
  const [planOpen, setPlanOpen] = useState(false)
  const progress = plan ? mobileNativeChatPlanProgress(plan) : null
  const checklist = view.checklist
  return (
    <>
      {plan && progress ? (
        <>
          <SheetSectionLabel label="Plan" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setPlanOpen(true)}
          >
            <Text style={styles.rowText}>{`${progress.done} of ${progress.total} done`}</Text>
            <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.1} />
          </Pressable>
          <MobilePlanSheet visible={planOpen} plan={plan} onClose={() => setPlanOpen(false)} />
        </>
      ) : null}
      {checklist ? (
        <>
          <SheetSectionLabel
            label="Checklist"
            count={`${checklist.checked}/${checklist.items.length}`}
          />
          <View style={styles.group}>
            {checklist.items.map((item, index) => (
              <View key={item.key}>
                {index > 0 ? <View style={styles.separator} /> : null}
                <MobileChecklistItemRow
                  item={item}
                  agentLabel={agentLabel}
                  readOnly={view.readOnly}
                  onToggle={(next) => {
                    void view.toggleItem(next)
                  }}
                  onOpen={view.openItem}
                />
              </View>
            ))}
          </View>
          <MobileNativeChatChecklistItemSheet view={view} agentLabel={agentLabel} />
        </>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.bodySize
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
  }
})
