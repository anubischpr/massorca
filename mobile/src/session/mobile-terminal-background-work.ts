// What a terminal-backed chat's pill and sheet read from the pane's status row, which the paired
// host already streams on the session tab: the subagents the agent runs, and when its own turn began.
// The host publishes no per-task detail for a pane's background shell commands, so those never list.

import {
  agentChildRowContextForParent,
  buildLegacyAgentChildRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from '../../../src/shared/agent-child-row-model'
import { isFreshNonDoneAgentStatus } from '../../../src/shared/agent-status-freshness'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'

export type MobileTerminalBackgroundWorkRead = {
  /** The pane's running subagents, each reading the verdict the connection and row allow. */
  rows: AgentChildRowModel[]
  /** The pane reports ongoing work it does not list (a background shell): the sheet says so. */
  unlistedWork: boolean
  /** Host-clock epoch ms the main agent's own turn began; null once it ended or never reported. */
  turnStartedAt: number | null
  /** Rows may leave the list as finished only while the pane's status is being heard. */
  live: boolean
  rowContext: AgentChildRowContext
}

const NO_STATUS_CONTEXT: AgentChildRowContext = {
  parentEvidenceFresh: false,
  transportObservation: 'unverifiable',
  parentObservedAt: 0,
  hostClockOffsetMs: 0
}

/** The turn's clock, only while the main agent itself works: a main agent that ended while its
 *  subagents run has no turn left to time. */
export function terminalTurnStartedAt(
  status: Pick<
    AgentStatusEntry,
    'state' | 'workingMode' | 'mainAgent' | 'turnStartedAt' | 'stateStartedAt'
  > | null
): number | null {
  if (!status || status.state !== 'working' || status.workingMode === 'monitoring') {
    return null
  }
  if (status.mainAgent && status.mainAgent.state !== 'working') {
    return null
  }
  return status.turnStartedAt ?? status.mainAgent?.stateStartedAt ?? status.stateStartedAt
}

export function readTerminalBackgroundWork(
  status: AgentStatusEntry | null | undefined,
  args: { connected: boolean; now: number }
): MobileTerminalBackgroundWorkRead {
  if (!status) {
    return {
      rows: [],
      unlistedWork: false,
      turnStartedAt: null,
      // No row at all is no claim about the pane; only a heard connection lets listed work end.
      live: args.connected,
      rowContext: {
        ...NO_STATUS_CONTEXT,
        transportObservation: args.connected ? 'live' : 'unverifiable'
      }
    }
  }
  const fresh = isFreshNonDoneAgentStatus(status, args.now)
  const base = agentChildRowContextForParent(status, fresh)
  const rowContext: AgentChildRowContext = {
    ...base,
    // A phone that stopped hearing the host cannot tell a running child from a finished one.
    transportObservation: args.connected ? base.transportObservation : 'unverifiable'
  }
  const rows = buildLegacyAgentChildRowModels(status.subagents ?? [], rowContext)
  return {
    rows,
    unlistedWork:
      rows.length === 0 &&
      fresh &&
      status.state === 'working' &&
      status.workingMode === 'monitoring',
    turnStartedAt: fresh ? terminalTurnStartedAt(status) : null,
    live: args.connected && rowContext.transportObservation === 'live',
    rowContext
  }
}
