import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'
import type { TeamProjectWork } from './BotTeamProjectTeamsWork'

// Why: the board unmounts on every Board/Brief toggle; its last list and statuses stay here so
// it paints the same columns at once and refreshes behind them.
const workByTeam = new Map<string, TeamProjectWork>()
const lastStatusBySession = new Map<string, AgentSessionStatusSummary>()

export function keptTeamWork(teamId: string): TeamProjectWork | undefined {
  return workByTeam.get(teamId)
}

export function keepTeamWork(teamId: string, work: TeamProjectWork): void {
  workByTeam.set(teamId, work)
}

export function keepSessionStatuses(statuses: AgentSessionStatusSnapshot): void {
  for (const [sessionId, summary] of statuses) {
    lastStatusBySession.set(sessionId, summary)
  }
}

/** The live summary, else the last one kept: the feed answers after the board paints. */
export function sessionStatusSummary(
  statuses: AgentSessionStatusSnapshot,
  sessionId: string | null
): AgentSessionStatusSummary | undefined {
  if (sessionId === null) {
    return undefined
  }
  return statuses.get(sessionId) ?? lastStatusBySession.get(sessionId)
}
