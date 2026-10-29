import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'
import type { DelegatedChild } from '../../../src/shared/delegated-children'
import { sayBackgroundTaskEnglish as say } from '../../../src/shared/background-task-copy'
import {
  backgroundTaskRowMeta,
  backgroundTaskRowStopId,
  type BackgroundTaskGroup
} from '../../../src/shared/background-task-roster'
import type { StructuredSessionBackgroundTasksView } from '../../../src/shared/structured-session-background-tasks-view'
import { AgentStateDot } from '../components/AgentStateDot'
import { BottomDrawer } from '../components/BottomDrawer'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { BackgroundTaskKindIcon } from './MobileBackgroundTaskKindIcon'
import { mobileAgentChildRowName, mobileAgentChildRowText } from './mobile-agent-child-row-text'
import { splitBackgroundWorkSections } from './mobile-background-work-sections'
import { MobileBackgroundChildRow, backgroundChildOpen } from './MobileBackgroundChildRow'
import type { BackgroundChildSessions } from './mobile-delegated-child-rows'

export type BackgroundWorkStopping = { taskIds: ReadonlySet<string>; all: boolean }

const NO_FINISHED: readonly BackgroundTaskGroup[] = []
const NO_CHILDREN: readonly DelegatedChild[] = []

// hitSlop requests 44pt hit rects; compact native parent bounds still limit their reach.
const MIN_TOUCH_TARGET = 44

type Props = {
  visible: boolean
  onClose: () => void
  groups: readonly BackgroundTaskGroup[]
  view: StructuredSessionBackgroundTasksView
  now: number
  /** `now` on the host's clock, which stamps every elapsed anchor. */
  hostNow: number
  stopping: BackgroundWorkStopping
  onStop: (taskId?: string) => void
  /** Work this phone watched end, under a section collapsed until opened. */
  finished?: readonly BackgroundTaskGroup[]
  /** The delegated child sessions this chat started: running ones first, settled ones under Finished. */
  childSessions?: BackgroundChildSessions
  /** What the sheet says when nothing runs or finished lists; defaults to the host's "unavailable" line. */
  emptyNote?: string
}

/** The session's running work, opened from the strip: tasks and subagents in two sections, each
 *  row with its elapsed time and its Stop where the host can stop it, then what has finished. */
export function MobileBackgroundWorkSheet({
  visible,
  onClose,
  groups,
  view,
  now,
  hostNow,
  stopping,
  onStop,
  finished = NO_FINISHED,
  childSessions,
  emptyNote = say('detailsUnavailable')
}: Props): React.JSX.Element {
  const [finishedOpen, setFinishedOpen] = useState(false)
  const sections = splitBackgroundWorkSections(groups)
  const renderRow = (row: AgentChildRowModel): React.JSX.Element => (
    <TaskRow
      key={row.id}
      row={row}
      now={now}
      hostNow={hostNow}
      supportsTaskStop={view.supportsStop}
      stopping={stopping}
      onStop={onStop}
    />
  )
  const taskRows = sections.tasks.flatMap((group) => group.tasks.map((entry) => entry.row))
  const agentRows = sections.agents.flatMap((group) => group.tasks.map((entry) => entry.row))
  const finishedRows = finished.flatMap((group) => group.tasks.map((entry) => entry.row))
  const childRunning = childSessions?.running ?? NO_CHILDREN
  const childFinished = childSessions?.finished ?? NO_CHILDREN
  const finishedCount = finishedRows.length + childFinished.length
  const renderChild = (child: DelegatedChild): React.JSX.Element => (
    <MobileBackgroundChildRow
      key={child.requestId}
      child={child}
      hostNow={hostNow}
      onOpen={backgroundChildOpen(child, childSessions)}
    />
  )
  return (
    <BottomDrawer visible={visible} onClose={onClose} dragContentToDismiss contentScrollable>
      <Text style={styles.title}>Background work</Text>
      {childRunning.length > 0 ? (
        <View>
          <SheetSectionLabel label="Child sessions" count={childRunning.length} />
          <View style={styles.group}>{childRunning.map(renderChild)}</View>
        </View>
      ) : null}
      {taskRows.length > 0 ? (
        <View>
          <SheetSectionLabel label="Tasks" count={taskRows.length} />
          <View style={styles.group}>{taskRows.map(renderRow)}</View>
        </View>
      ) : null}
      {agentRows.length > 0 ? (
        <View>
          <SheetSectionLabel label="Agents" count={agentRows.length} />
          <View style={styles.group}>{agentRows.map(renderRow)}</View>
        </View>
      ) : null}
      {taskRows.length === 0 &&
      agentRows.length === 0 &&
      childRunning.length === 0 &&
      finishedCount === 0 ? (
        <Text style={styles.unavailable}>{emptyNote}</Text>
      ) : null}
      {finishedCount > 0 ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Finished, ${finishedCount}`}
            accessibilityState={{ expanded: finishedOpen }}
            hitSlop={6}
            style={({ pressed }) => [styles.finishedToggle, pressed && styles.pressed]}
            onPress={() => setFinishedOpen((open) => !open)}
          >
            {finishedOpen ? (
              <ChevronDown size={14} color={colors.textMuted} strokeWidth={2} />
            ) : (
              <ChevronRight size={14} color={colors.textMuted} strokeWidth={2} />
            )}
            <View style={styles.finishedLabel}>
              <SheetSectionLabel label="Finished" count={finishedCount} />
            </View>
          </Pressable>
          {finishedOpen ? (
            <View style={styles.group}>
              {childFinished.map(renderChild)}
              {finishedRows.map(renderRow)}
            </View>
          ) : null}
        </View>
      ) : null}
      {!view.supportsStop && view.supportsStopAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={say('stopAll')}
          accessibilityState={{ disabled: stopping.all }}
          disabled={stopping.all}
          hitSlop={6}
          style={({ pressed }) => [
            styles.textAction,
            styles.stopAll,
            pressed && styles.pressed,
            stopping.all && styles.disabled
          ]}
          onPress={() => onStop()}
        >
          <Text style={styles.actionLabel}>{say('stop')}</Text>
        </Pressable>
      ) : null}
    </BottomDrawer>
  )
}

function TaskRow({
  row,
  now,
  hostNow,
  supportsTaskStop,
  stopping,
  onStop
}: {
  row: AgentChildRowModel
  now: number
  /** `now` on the host's clock, which stamps every elapsed anchor. */
  hostNow: number
  supportsTaskStop: boolean
  stopping: BackgroundWorkStopping
  onStop: (taskId: string) => void
}): React.JSX.Element {
  const { lead, trail } = mobileAgentChildRowText(row, now)
  const meta = backgroundTaskRowMeta(row, hostNow)
  const stopId = backgroundTaskRowStopId(row, supportsTaskStop)
  const busy = stopId !== null && stopping.taskIds.has(stopId)
  return (
    <>
      <View testID="background-task-row" style={styles.row}>
        <BackgroundTaskKindIcon kind={row.kind} size={14} />
        <AgentStateDot state={row.displayState} />
        <Text style={styles.rowText} numberOfLines={1} ellipsizeMode="tail">
          <Text style={styles.lead}>{lead}</Text>
          {trail ? <Text style={styles.trail}>{` · ${trail}`}</Text> : null}
        </Text>
        {meta ? (
          // Reticks every second; screen readers hear the row's state, not its clock.
          <Text style={styles.meta} importantForAccessibility="no" accessibilityElementsHidden>
            {meta}
          </Text>
        ) : null}
        {stopId !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={say('stopTask', { value0: mobileAgentChildRowName(row) })}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={6}
            style={({ pressed }) => [
              styles.textAction,
              pressed && styles.pressed,
              busy && styles.disabled
            ]}
            onPress={() => onStop(stopId)}
          >
            <Text style={styles.actionLabel}>{say('stop')}</Text>
          </Pressable>
        ) : null}
      </View>
      {row.owned.length > 0 ? (
        // Work a child owns (its shell, a nested agent) reads beneath it, not in its kind's group.
        <View style={styles.owned}>
          {row.owned.map((owned) => (
            <TaskRow
              key={owned.id}
              row={owned}
              now={now}
              hostNow={hostNow}
              supportsTaskStop={supportsTaskStop}
              stopping={stopping}
              onStop={onStop}
            />
          ))}
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs
  },
  group: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs
  },
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  owned: {
    marginLeft: spacing.lg
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.metaSize
  },
  lead: {
    color: colors.textPrimary,
    fontWeight: '500'
  },
  trail: {
    color: colors.textMuted
  },
  meta: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily
  },
  finishedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs
  },
  finishedLabel: {
    flex: 1
  },
  unavailable: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    padding: spacing.md
  },
  textAction: {
    minHeight: 32,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button
  },
  stopAll: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.sm
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '500'
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  disabled: {
    opacity: 0.5
  }
})
