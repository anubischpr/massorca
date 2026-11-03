import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { botTeamBoardColumn } from '../../../../shared/bot-team-board-column'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'

/**
 * The tasks not yet Done, or null while a started task's live status has not arrived: until then
 * the status reads as unknown, and counting it open would show a number that later drops.
 */
export function openBotTeamTaskCount(
  tasks: readonly { sessionId: string | null }[],
  statuses: ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>
): number | null {
  let open = 0
  for (const task of tasks) {
    if (task.sessionId !== null && !statuses.has(task.sessionId)) {
      return null
    }
    const status = botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
    if (botTeamBoardColumn(status) !== 'Done') {
      open += 1
    }
  }
  return open
}
