import type { AgentSessionStatusSummary } from './agent-session-wire'

export type BotTeamTaskStatus =
  | 'Not started'
  | 'Working'
  | 'Waiting for you'
  | 'Stopped'
  | 'Stuck'
  | 'Done'

/** The status a task shows. No session means it waits in Todo; a stop or a cut-off turn is Stopped. */
export function botTeamTaskStatus(
  sessionId: string | null,
  summary: Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'> | undefined
): BotTeamTaskStatus {
  if (sessionId === null) {
    return 'Not started'
  }
  if (summary?.status === 'attention') {
    return 'Waiting for you'
  }
  if (summary?.status !== 'idle') {
    return 'Working'
  }
  if (summary.turnOutcome === 'cancellation' || summary.turnOutcome === 'interruption') {
    return 'Stopped'
  }
  return summary.turnOutcome === 'failure' ? 'Stuck' : 'Done'
}
