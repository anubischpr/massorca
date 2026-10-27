import { memo, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Bot, SquareTerminal } from 'lucide-react-native'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  backgroundTasksStripTicks,
  buildBackgroundTaskGroups,
  buildBackgroundTaskGroupsFromViews
} from '../../../src/shared/background-task-roster'
import { useNow } from '../hooks/use-now'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { MobileBackgroundWorkSheet, type BackgroundWorkStopping } from './MobileBackgroundWorkSheet'
import {
  mobileChatStatusPill,
  mobileStatusPillAccessibilityLabel,
  mobileStatusPillCounts
} from './mobile-chat-status-pill'
import type { MobileStructuredBackgroundTasks } from './use-mobile-structured-background-tasks'

const NOT_STOPPING: BackgroundWorkStopping = { taskIds: new Set(), all: false }

/** The floating status pill above a structured chat's composer: "Working", the turn's clock, and the
 *  running terminals and agents. A tap opens the background-work sheet, which holds the rows. Shown
 *  while a turn runs or background work is running; a lane with no start shows no clock. Mounted per
 *  conversation, so its open and stopping state outlive a roster that empties between children. */
function MobileNativeChatBackgroundTasksImpl({
  tasks,
  working = false,
  startedAt = null
}: {
  tasks: MobileStructuredBackgroundTasks
  /** The chat's turn is running. */
  working?: boolean
  /** Host-clock epoch ms the turn started, or null where the lane publishes none. */
  startedAt?: number | null
}): React.JSX.Element | null {
  const { view, rowContext, stop } = tasks
  const [sheetOpen, setSheetOpen] = useState(false)
  const [stopping, setStopping] = useState<BackgroundWorkStopping>(NOT_STOPPING)
  const stoppingRef = useRef(NOT_STOPPING)
  const groups = useMemo(
    () =>
      view.children !== undefined
        ? buildBackgroundTaskGroupsFromViews(view.children, rowContext)
        : buildBackgroundTaskGroups(view.tasks, view.settledTasks, say),
    [view.children, view.tasks, view.settledTasks, rowContext]
  )
  const now = useNow(1_000, working || (view.show && backgroundTasksStripTicks(groups, sheetOpen)))
  // Elapsed anchors are host-stamped; read them on the host's clock, as the turn's start is.
  const hostNow = now - rowContext.hostClockOffsetMs
  const pill = mobileChatStatusPill({
    working,
    startedAt,
    now: hostNow,
    counts: mobileStatusPillCounts(groups),
    hasBackgroundWork: view.show,
    live: rowContext.transportObservation === 'live'
  })
  if (!pill.visible) {
    return null
  }

  const updateStopping = (next: BackgroundWorkStopping): void => {
    stoppingRef.current = next
    setStopping(next)
  }
  // A press already on its way holds its button; the ref closes the same-frame double tap.
  const onStop = (taskId?: string): void => {
    const current = stoppingRef.current
    if (taskId ? current.taskIds.has(taskId) : current.all) {
      return
    }
    updateStopping({
      taskIds: taskId ? new Set([...current.taskIds, taskId]) : current.taskIds,
      all: taskId ? current.all : true
    })
    void stop(taskId).finally(() => {
      const latest = stoppingRef.current
      const taskIds = new Set(latest.taskIds)
      if (taskId) {
        taskIds.delete(taskId)
      }
      updateStopping({ taskIds, all: taskId ? latest.all : false })
    })
  }

  return (
    <View style={styles.list} testID="background-tasks-strip">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mobileStatusPillAccessibilityLabel(pill)}
        hitSlop={spacing.xs}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        onPress={() => setSheetOpen(true)}
      >
        <View style={styles.dot} />
        <Text style={styles.label}>{pill.label}</Text>
        {pill.elapsed ? <Text style={styles.elapsed}>{pill.elapsed}</Text> : null}
        {pill.terminals !== null || pill.agents !== null ? <View style={styles.divider} /> : null}
        {pill.terminals !== null ? (
          <View style={styles.count}>
            <SquareTerminal size={13} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.countText}>{pill.terminals}</Text>
          </View>
        ) : null}
        {pill.agents !== null ? (
          <View style={styles.count}>
            <Bot size={13} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.countText}>{pill.agents}</Text>
          </View>
        ) : null}
      </Pressable>
      <MobileBackgroundWorkSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        view={view}
        now={now}
        hostNow={hostNow}
        stopping={stopping}
        onStop={onStop}
      />
    </View>
  )
}

export const MobileNativeChatBackgroundTasks = memo(MobileNativeChatBackgroundTasksImpl)

const styles = StyleSheet.create({
  // Left-aligned in the tray above the composer: the transcript ends above it, so it covers no message.
  list: {
    alignItems: 'flex-start',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs
  },
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.md,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.statusAmber
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.bodySize - 1,
    fontWeight: '500'
  },
  elapsed: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: colors.borderSubtle
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  countText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  }
})
