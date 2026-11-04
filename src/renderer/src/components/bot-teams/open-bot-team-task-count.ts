import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { botTeamBoardColumn } from '../../../../shared/bot-team-board-column'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'

/** How long a started task's session may go unreported before it counts as open. */
export const UNREPORTED_SESSION_GRACE_MS = 10_000

/**
 * The tasks not yet Done, or null while a started task's live status is still unknown. A session the
 * feed has not reported counts as open once it is in `expired`, which the grace period fills in.
 */
export function openBotTeamTaskCount(
  tasks: readonly { sessionId: string | null }[],
  statuses: ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>,
  expired: ReadonlySet<string> = new Set()
): number | null {
  let open = 0
  for (const task of tasks) {
    const sessionId = task.sessionId
    if (sessionId !== null && !statuses.has(sessionId)) {
      if (!expired.has(sessionId)) {
        return null
      }
      open += 1
      continue
    }
    const status = botTeamTaskStatus(
      sessionId,
      sessionId === null ? undefined : statuses.get(sessionId)
    )
    if (botTeamBoardColumn(status) !== 'Done') {
      open += 1
    }
  }
  return open
}
