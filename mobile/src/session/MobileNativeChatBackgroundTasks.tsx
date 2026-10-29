import { memo, useContext, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  backgroundTasksStripTicks,
  buildBackgroundTaskGroups,
  buildBackgroundTaskGroupsFromViews,
  groupBackgroundTaskRows
} from '../../../src/shared/background-task-roster'
import { useNow } from '../hooks/use-now'
import { spacing } from '../theme/mobile-theme'
import { MobileBackgroundWorkSheet, type BackgroundWorkStopping } from './MobileBackgroundWorkSheet'
import { MobileChatStatusPillView } from './MobileChatStatusPillView'
import {
  mobileChatStatusPill,
  mobileStatusPillCounts,
  mobileStatusPillFinishedCount
} from './mobile-chat-status-pill'
import { NO_BACKGROUND_WORK_NOTE } from './mobile-background-work-notes'
import { mergeFinishedBackgroundRows, settledHistoryRows } from './mobile-finished-background-work'
import { MobileDelegatedChildContext } from './mobile-delegated-child-access'
import {
  finishedDelegatedChildren,
  MobileDelegatedChildrenContext,
  runningDelegatedChildren,
  type BackgroundChildSessions
} from './mobile-delegated-child-rows'
import { useSeenBackgroundWork } from './use-mobile-seen-background-work'
import type { MobileStructuredBackgroundTasks } from './use-mobile-structured-background-tasks'

const NOT_STOPPING: BackgroundWorkStopping = { taskIds: new Set(), all: false }

/** The floating status pill above a structured chat's composer, with the background-work sheet it
 *  opens. Shown while a turn runs, background work runs, or finished work is listed; a lane with no
 *  start shows no clock. Mounted per conversation, so its open and stopping state outlive a roster
 *  that empties between children. */
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
  // Rows this roster stopped listing while its stream was live have finished; a lost stream asserts
  // nothing.
  const rows = useMemo(
    () => groups.flatMap((group) => group.tasks.map((entry) => entry.row)),
    [groups]
  )
  const seenFinished = useSeenBackgroundWork({
    scopeKey: tasks.sessionKey,
    rows,
    live: rowContext.transportObservation === 'live',
    hostClockOffsetMs: rowContext.hostClockOffsetMs
  })
  // The history names the commands that already ended, so Finished lists them before this phone watched.
  const historyFinished = useMemo(
    () => settledHistoryRows(tasks.commandActivity, rowContext),
    [tasks.commandActivity, rowContext]
  )
  const finishedRows = useMemo(
    () =>
      mergeFinishedBackgroundRows({ seen: seenFinished, history: historyFinished, running: rows }),
    [seenFinished, historyFinished, rows]
  )
  const finished = useMemo(() => groupBackgroundTaskRows(finishedRows), [finishedRows])
  // The chat's delegated children read from its journal; a lost stream claims none of them running.
  const delegated = useContext(MobileDelegatedChildrenContext)
  const delegatedAccess = useContext(MobileDelegatedChildContext)
  const childRunning = useMemo(
    () => runningDelegatedChildren(delegated.children),
    [delegated.children]
  )
  const childFinished = useMemo(
    () => finishedDelegatedChildren(delegated.children),
    [delegated.children]
  )
  const childSessions = useMemo<BackgroundChildSessions | undefined>(
    () =>
      delegated.children.length > 0
        ? {
            running: childRunning,
            finished: childFinished,
            canOpen: (childSessionId) => delegatedAccess?.hasChild(childSessionId) ?? false,
            open: (childSessionId) => {
              setSheetOpen(false)
              delegatedAccess?.openChild(childSessionId)
            }
          }
        : undefined,
    [delegated.children.length, childRunning, childFinished, delegatedAccess]
  )
  const liveChildRunning = rowContext.transportObservation === 'live' ? childRunning.length : 0
  const pillCounts = mobileStatusPillCounts(groups)
  const pill = mobileChatStatusPill({
    working,
    startedAt,
    now: hostNow,
    counts: { terminals: pillCounts.terminals, agents: pillCounts.agents + liveChildRunning },
    hasBackgroundWork: view.show || liveChildRunning > 0,
    finishedCount: mobileStatusPillFinishedCount(finished) + childFinished.length,
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
        finished={finished}
        childSessions={childSessions}
        // Unlisted running work is named as such; a plain turn with nothing running says so.
        emptyNote={view.show ? say('detailsUnavailable') : NO_BACKGROUND_WORK_NOTE}
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
