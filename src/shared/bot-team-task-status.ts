import type { AgentSessionStatusSummary } from './agent-session-wire'

export type BotTeamTaskStatus =
  | 'Not started'
  | 'Unknown'
  | 'Working'
  | 'Waiting for you'
  | 'Stopped'
  | 'Stuck'
  | 'Done'

/** The terminal statuses a task keeps on the host, so a board can place it before the host answers. */
export const BOT_TEAM_TASK_LAST_STATUSES = ['Done', 'Stopped', 'Stuck'] as const
export type BotTeamTaskLastStatus = (typeof BOT_TEAM_TASK_LAST_STATUSES)[number]

export function isBotTeamTaskLastStatus(
  status: BotTeamTaskStatus
): status is BotTeamTaskLastStatus {
  return status === 'Done' || status === 'Stopped' || status === 'Stuck'
}

/**
 * The status a task shows. No session means it waits in Todo; a stop or a cut-off turn is Stopped.
 * Until the host answers for the session it is Unknown, never Working.
 */
export function botTeamTaskStatus(
  sessionId: string | null,
  summary: Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'> | undefined
): BotTeamTaskStatus {
  if (sessionId === null) {
    return 'Not started'
  }
  if (summary === undefined || summary.status === null) {
    return 'Unknown'
  }
  if (summary.status === 'attention') {
    return 'Waiting for you'
  }
  if (summary.status !== 'idle') {
    return 'Working'
  }
  if (summary.turnOutcome === 'cancellation' || summary.turnOutcome === 'interruption') {
    return 'Stopped'
  }
  return summary.turnOutcome === 'failure' ? 'Stuck' : 'Done'
}
