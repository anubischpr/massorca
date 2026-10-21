import { useState } from 'react'
import { NativeChatBackgroundTasksStatus } from './NativeChatBackgroundTasksStatus'
import type { StructuredSessionBackgroundTasksView } from '../../../../shared/structured-session-background-tasks-view'
import { useNativeChatBackgroundTasksRevealSequence } from './native-chat-background-tasks-reveal'
import { useStructuredSessionChildRowContext } from './use-structured-session-child-row-context'
import type { BackgroundTaskStopping } from './use-background-task-stopping'

export function NativeChatStructuredSessionStatus(props: {
  sessionId: string
  /** The session's own status row, whose verdict the strip's children read. */
  paneKey: string
  isVisible: boolean
  backgroundTasks: StructuredSessionBackgroundTasksView
  /** The session's in-flight stops, owned above so the summary card disables the same Stop. */
  backgroundStops: BackgroundTaskStopping
}): React.JSX.Element {
  // Each `/ps` bumps it; the strip opens for a request it has not yet been collapsed since.
  const revealSequence = useNativeChatBackgroundTasksRevealSequence(props.sessionId)
  const [expanded, setExpanded] = useState<{
    sessionId: string
    expanded: boolean
    revealSeen: number
  } | null>(null)
  const open =
    expanded?.sessionId === props.sessionId &&
    (expanded.expanded || revealSequence > expanded.revealSeen)
  const revealed = revealSequence > 0 && expanded?.sessionId !== props.sessionId
  const childRowContext = useStructuredSessionChildRowContext(props.paneKey)

  return (
    <>
      {props.backgroundTasks.show ? (
        <NativeChatBackgroundTasksStatus
          isVisible={props.isVisible}
          tasks={props.backgroundTasks.tasks}
          settledTasks={props.backgroundTasks.settledTasks}
          {...(props.backgroundTasks.children
            ? { childViews: props.backgroundTasks.children, childRowContext }
            : {})}
          indicatorActive={props.backgroundTasks.isMonitoring}
          supportsTaskStop={props.backgroundTasks.supportsStop}
          supportsStopAll={props.backgroundTasks.supportsStopAll}
          stoppingTaskIds={props.backgroundStops.stoppingTaskIds}
          stoppingAll={props.backgroundStops.stoppingAll}
          expanded={open || revealed}
          onExpandedChange={(value) =>
            setExpanded({
              sessionId: props.sessionId,
              expanded: value,
              revealSeen: revealSequence
            })
          }
          onStop={props.backgroundStops.onStop}
        />
      ) : null}
    </>
  )
}
