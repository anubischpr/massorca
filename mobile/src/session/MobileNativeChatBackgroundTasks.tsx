import { memo, useMemo, useRef, useState } from 'react'
import { Dimensions, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronUp } from 'lucide-react-native'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  backgroundTasksHeaderContent,
  backgroundTasksHeaderText,
  NARROW_BACKGROUND_TASKS_STRIP_REM
} from '../../../src/shared/background-task-header-content'
import {
  backgroundTasksStripTicks,
  buildBackgroundTaskGroups,
  buildBackgroundTaskGroupsFromViews
} from '../../../src/shared/background-task-roster'
import { useNow } from '../hooks/use-now'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { BackgroundTaskKindIcon } from './MobileBackgroundTaskKindIcon'
import { MobileBackgroundWorkSheet, type BackgroundWorkStopping } from './MobileBackgroundWorkSheet'
import type { MobileStructuredBackgroundTasks } from './use-mobile-structured-background-tasks'

// React Native has no root font; its points stand in for desktop's 16 px rem.
const NARROW_STRIP_WIDTH = NARROW_BACKGROUND_TASKS_STRIP_REM * 16

const NOT_STOPPING: BackgroundWorkStopping = { taskIds: new Set(), all: false }

/** The session's running child work as one indicator above the composer. Desktop parity:
 *  `NativeChatBackgroundTasksStatus`, from the same host roster, shared grouping, header and Stop
 *  rules. Tapping it opens the background-work sheet, which holds the rows. Mounted per
 *  conversation, so its open and stopping state outlive the moment a sequential fan-out's roster
 *  empties between children. */
function MobileNativeChatBackgroundTasksImpl({
  tasks
}: {
  tasks: MobileStructuredBackgroundTasks
}): React.JSX.Element | null {
  const { view, rowContext, stop } = tasks
  const [sheetOpen, setSheetOpen] = useState(false)
  // Before the first layout, the window less the strip's own margins, so it opens in its final form.
  const [narrow, setNarrow] = useState(
    () => Dimensions.get('window').width - 2 * spacing.lg < NARROW_STRIP_WIDTH
  )
  const [stopping, setStopping] = useState<BackgroundWorkStopping>(NOT_STOPPING)
  const stoppingRef = useRef(NOT_STOPPING)
  const groups = useMemo(
    () =>
      view.children !== undefined
        ? buildBackgroundTaskGroupsFromViews(view.children, rowContext)
        : buildBackgroundTaskGroups(view.tasks, view.settledTasks, say),
    [view.children, view.tasks, view.settledTasks, rowContext]
  )
  const now = useNow(1_000, view.show && backgroundTasksStripTicks(groups, sheetOpen))
  if (!view.show) {
    return null
  }
  // Elapsed anchors are host-stamped; read them on the host's clock, as the turn bar's start is.
  const hostNow = now - rowContext.hostClockOffsetMs
  const header = backgroundTasksHeaderContent(groups, { narrow, now: hostNow }, say)

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
  const onLayout = (event: LayoutChangeEvent): void => {
    setNarrow(event.nativeEvent.layout.width < NARROW_STRIP_WIDTH)
  }

  return (
    <View style={styles.list} onLayout={onLayout} testID="background-tasks-strip">
      <View style={styles.box}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backgroundTasksHeaderText(header)}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
          onPress={() => setSheetOpen(true)}
        >
          <View style={styles.headerText}>
            {header.segments.map((segment, index) => {
              return (
                <View key={segment.kind ?? 'total'} style={styles.segment}>
                  {index > 0 ? <Text style={styles.separator}>·</Text> : null}
                  {segment.kind ? (
                    // The turn owns the voice: same icons, dimmed until it ends.
                    <View style={view.isMonitoring ? undefined : styles.dimmed}>
                      <BackgroundTaskKindIcon kind={segment.kind} size={12} />
                    </View>
                  ) : null}
                  <Text style={styles.segmentText} numberOfLines={1} ellipsizeMode="tail">
                    {segment.text}
                  </Text>
                </View>
              )
            })}
            {header.detail ? (
              <Text style={styles.detail} numberOfLines={1} ellipsizeMode="tail">
                {header.segments.length > 0 ? `— ${header.detail}` : header.detail}
              </Text>
            ) : null}
          </View>
          <ChevronUp size={14} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>
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
  list: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs
  },
  box: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    overflow: 'hidden'
  },
  header: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    overflow: 'hidden'
  },
  // Every piece may shrink, so large Dynamic Type ellipsizes the header instead of clipping it.
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0
  },
  separator: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  segmentText: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '500'
  },
  detail: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  dimmed: {
    opacity: 0.4
  },
  pressed: {
    backgroundColor: colors.bgRaised
  }
})
