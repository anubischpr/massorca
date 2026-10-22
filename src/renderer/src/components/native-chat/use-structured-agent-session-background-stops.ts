import { useBackgroundTaskStopping } from './use-background-task-stopping'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

/** Stops a session's background tasks, and keeps one copy of the stops still in flight, read by
 *  both the strip and the summary card. */
export function useStructuredAgentSessionBackgroundStops(
  sessionId: string,
  mutate: StructuredAgentSessionMutate
) {
  const stopBackgroundTask = (taskId?: string) =>
    mutate('agentSession.cancel', 'agentSession.cancel', {
      turnId: 'background-tasks',
      scope: 'background-tasks',
      ...(taskId ? { taskId } : {})
    })
  const backgroundStops = useBackgroundTaskStopping({ sessionId, stopBackgroundTask })
  return { stopBackgroundTask, backgroundStops }
}
