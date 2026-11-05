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
 * Until the host answers for the session it is Unknown, never Working. A finished turn whose bot
 * ended on a question for the person (`awaitingPerson`) waits for them instead of reading Done.
 */
export function botTeamTaskStatus(
  sessionId: string | null,
  summary: Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'> | undefined,
  awaitingPerson = false
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
  if (summary.turnOutcome === 'failure') {
    return 'Stuck'
  }
  return awaitingPerson ? 'Waiting for you' : 'Done'
}

/** A status a client already worked out, with Done read as Waiting for you while the person owes an answer. */
export function botTeamStatusAwaiting(
  status: BotTeamTaskStatus,
  awaitingPerson: boolean | undefined
): BotTeamTaskStatus {
  return awaitingPerson === true && status === 'Done' ? 'Waiting for you' : status
}

/** A task's status read from a map of its team's live session summaries. */
export function botTeamTaskStatusIn(
  task: { sessionId: string | null; awaitingPerson?: boolean },
  statuses: ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>
): BotTeamTaskStatus {
  return botTeamTaskStatus(
    task.sessionId,
    task.sessionId === null ? undefined : statuses.get(task.sessionId),
    task.awaitingPerson === true
  )
}
