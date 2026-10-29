import { StyleSheet, Text, View } from 'react-native'
import { Circle, CircleCheck, CircleDot } from 'lucide-react-native'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  nativeChatTaskLabel,
  type NativeChatTask,
  type NativeChatTaskList
} from '../../../src/shared/native-chat-task-list'
import { mobileNativeChatPlanProgress } from './mobile-native-chat-plan'

type Props = {
  visible: boolean
  /** The chat's plan with at least one step; null until the agent plans its work. */
  plan: NativeChatTaskList | null
  onClose: () => void
}

/** The agent's plan as steps with a progress bar: completed, in progress, and pending. */
export function MobilePlanSheet({ visible, plan, onClose }: Props): React.JSX.Element {
  const progress = plan ? mobileNativeChatPlanProgress(plan) : { done: 0, total: 0 }
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <BottomDrawer visible={visible} onClose={onClose} dragContentToDismiss contentScrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        {plan ? (
          <Text style={styles.count}>{`${progress.done} of ${progress.total} done`}</Text>
        ) : null}
      </View>
      {plan ? (
        <>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
          >
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          {plan.explanation ? <Text style={styles.explanation}>{plan.explanation}</Text> : null}
          <SheetSectionLabel label="Steps" count={progress.total} />
          <View style={styles.group}>
            {plan.tasks.map((task, index) => (
              <View key={`${index}:${task.content}`} style={styles.step}>
                <StepIcon task={task} />
                <Text
                  style={[styles.stepText, task.status === 'completed' && styles.stepDone]}
                  numberOfLines={3}
                >
                  {nativeChatTaskLabel(task)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={[styles.group, styles.empty]}>
          <Text style={styles.emptyTitle}>No plan yet</Text>
          <Text style={styles.emptyBody}>
            The agent's steps appear here once it plans its work.
          </Text>
        </View>
      )}
    </BottomDrawer>
  )
}

function StepIcon({ task }: { task: NativeChatTask }): React.JSX.Element {
  switch (task.status) {
    case 'completed':
      return <CircleCheck size={16} color={colors.statusGreen} strokeWidth={2.1} />
    case 'in_progress':
      return <CircleDot size={16} color={colors.statusAmber} strokeWidth={2.1} />
    case 'pending':
      return <Circle size={16} color={colors.textMuted} strokeWidth={2.1} />
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm
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
    height: 4,
    marginHorizontal: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.bgRaised,
    overflow: 'hidden'
  },
  fill: {
    height: 4,
    backgroundColor: colors.statusGreen
  },
  explanation: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  group: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  step: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  stepText: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  stepDone: {
    color: colors.textMuted
  },
  empty: {
    paddingVertical: spacing.md,
    gap: spacing.xs
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
