import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { AppState } from '@/store/types'

type AcknowledgedAgentTimesState = Pick<AppState, 'acknowledgedAgentsByPaneKey'>

/** Projects only the acknowledgement timestamps rendered by one card. */
export function selectAcknowledgedAgentTimes(
  state: AcknowledgedAgentTimesState,
  agents: readonly Pick<DashboardAgentRow, 'paneKey'>[]
): number[] {
  return agents.map((agent) => state.acknowledgedAgentsByPaneKey[agent.paneKey] ?? 0)
}

/** Whether each row's current state is still unseen, keyed by pane; the times line up with `agents`. */
export function unvisitedByPaneKeyFor(
  agents: readonly Pick<DashboardAgentRow, 'paneKey' | 'entry'>[],
  acknowledgedAgentTimes: readonly number[]
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [index, agent] of agents.entries()) {
    out[agent.paneKey] = (acknowledgedAgentTimes[index] ?? 0) < agent.entry.stateStartedAt
  }
  return out
}
