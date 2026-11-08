import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'

export type BotTeamApprovalRow = {
  taskId: string
  teamId: string
  title: string
  teamName: string
  botName: string
}

/** Started tasks whose bot waits for the person, read from the same status feed the room shows. */
export function deriveBotTeamApprovalRows(input: {
  teams: readonly BotTeam[]
  tasksByTeamId: Readonly<Record<string, readonly BotTeamTask[]>>
  statuses: ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>
}): BotTeamApprovalRow[] {
  const rows: BotTeamApprovalRow[] = []
  for (const team of input.teams) {
    for (const task of input.tasksByTeamId[team.id] ?? []) {
      if (task.sessionId === null) {
        continue
      }
      if (
        botTeamTaskStatus(
          task.sessionId,
          input.statuses.get(task.sessionId),
          task.awaitingPerson === true
        ) !== 'Waiting for you'
      ) {
        continue
      }
      rows.push({
        taskId: task.id,
        teamId: team.id,
        title: task.title,
        teamName: team.name,
        botName: team.bots.find((bot) => bot.id === task.ownerBotId)?.name ?? ''
      })
    }
  }
  return rows
}
