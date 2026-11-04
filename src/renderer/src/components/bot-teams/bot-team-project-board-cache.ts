import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'
import type { TeamProjectWork } from './BotTeamProjectTeamsWork'

export type TeamTaskList = Pick<TeamProjectWork, 'tasks' | 'projects'>

// Why: the board unmounts on every Board/Brief toggle; its last list and statuses stay here so
// it paints the same columns at once and refreshes behind them.
const workByTeam = new Map<string, TeamProjectWork>()
const taskListByTeam = new Map<string, TeamTaskList>()
const lastStatusBySession = new Map<string, AgentSessionStatusSummary>()

export function keptTeamWork(teamId: string): TeamProjectWork | undefined {
  return workByTeam.get(teamId)
}

export function keepTeamWork(teamId: string, work: TeamProjectWork): void {
  workByTeam.set(teamId, work)
}

/** The team board's last task and project list, painted before its refreshed list lands. */
export function keptTeamTaskList(teamId: string): TeamTaskList | undefined {
  return taskListByTeam.get(teamId)
}

export function keepTeamTaskList(teamId: string, list: TeamTaskList): void {
  taskListByTeam.set(teamId, list)
}

export function keepSessionStatuses(statuses: AgentSessionStatusSnapshot): void {
  for (const [sessionId, summary] of statuses) {
    lastStatusBySession.set(sessionId, summary)
  }
}

/** The last summary kept for a session: where its task sits until the feed answers. */
export function keptSessionSummary(
  sessionId: string | null
): AgentSessionStatusSummary | undefined {
  return sessionId === null ? undefined : lastStatusBySession.get(sessionId)
}
