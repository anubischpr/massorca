import { memo, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  backgroundTasksStripTicks,
  buildBackgroundTaskGroups,
  buildBackgroundTaskGroupsFromViews
} from '../../../src/shared/background-task-roster'
import { useNow } from '../hooks/use-now'
import { spacing } from '../theme/mobile-theme'
import { MobileBackgroundWorkSheet, type BackgroundWorkStopping } from './MobileBackgroundWorkSheet'
import { MobileChatStatusPillView } from './MobileChatStatusPillView'
import { mobileChatStatusPill, mobileStatusPillCounts } from './mobile-chat-status-pill'
import type { MobileStructuredBackgroundTasks } from './use-mobile-structured-background-tasks'

const NOT_STOPPING: BackgroundWorkStopping = { taskIds: new Set(), all: false }

/** The floating status pill above a structured chat's composer, with the background-work sheet it
 *  opens. Shown while a turn runs or background work is running; a lane with no start shows no clock.
 *  Mounted per conversation, so its open and stopping state outlive a roster that empties between
 *  children. */
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
      <MobileChatStatusPillView pill={pill} onPress={() => setSheetOpen(true)} />
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
  }
})
