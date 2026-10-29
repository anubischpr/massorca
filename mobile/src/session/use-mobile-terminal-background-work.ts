// A terminal-backed chat's background work: the pane's running subagents grouped for the sheet,
// and the ones this phone watched end, kept under Finished.

import { useMemo } from 'react'
import type { AgentChildRowContext } from '../../../src/shared/agent-child-row-model'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import {
  groupBackgroundTaskRows,
  type BackgroundTaskGroup
} from '../../../src/shared/background-task-roster'
import { readTerminalBackgroundWork } from './mobile-terminal-background-work'
import { useSeenBackgroundWork } from './use-mobile-seen-background-work'

export type MobileTerminalBackgroundWork = {
  groups: BackgroundTaskGroup[]
  finished: BackgroundTaskGroup[]
  unlistedWork: boolean
  turnStartedAt: number | null
  rowContext: AgentChildRowContext
}

export function useMobileTerminalBackgroundWork(args: {
  /** The chat these rows belong to; another chat starts its Finished list over. */
  scopeKey: string
  status: AgentStatusEntry | null | undefined
  /** This phone is hearing the paired host. */
  connected: boolean
  /** Phone epoch ms; a status that stopped arriving ages as the caller's clock moves it. */
  now: number
}): MobileTerminalBackgroundWork {
  const { scopeKey, status, connected, now } = args
  const read = useMemo(
    () => readTerminalBackgroundWork(status, { connected, now }),
    [status, connected, now]
  )
  const finishedRows = useSeenBackgroundWork({
    scopeKey,
    rows: read.rows,
    live: read.live,
    hostClockOffsetMs: read.rowContext.hostClockOffsetMs
  })
  const groups = useMemo(() => groupBackgroundTaskRows(read.rows), [read.rows])
  const finished = useMemo(() => groupBackgroundTaskRows(finishedRows), [finishedRows])
  const { unlistedWork, turnStartedAt, rowContext } = read
  return { groups, finished, unlistedWork, turnStartedAt, rowContext }
}
