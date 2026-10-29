// Finished background work from the chat's command history, merged with the rows this phone saw
// end. The live roster lists running work only; the history also keeps the commands that already
// finished, so a chat opened after they ended still lists them under Finished.

import {
  buildAgentChildRowModels,
  flattenAgentChildRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from '../../../src/shared/agent-child-row-model'
import type { AgentChildWorkView } from '../../../src/shared/agent-status-child-work-view'
import { MAX_FINISHED_BACKGROUND_ROWS } from './mobile-seen-background-work'

/** The settled rows of a command history. Running work is the live roster's, never history. */
export function settledHistoryRows(
  history: readonly AgentChildWorkView[] | undefined,
  context: AgentChildRowContext
): AgentChildRowModel[] {
  if (history === undefined || history.length === 0) {
    return []
  }
  return buildAgentChildRowModels(
    history.filter((view) => view.membership === 'settled'),
    context
  )
}

/** Finished rows, newest first: the rows this phone saw end, then history rows it did not. A row
 *  still running is never finished, and the list is bounded like the seen list. */
export function mergeFinishedBackgroundRows(args: {
  seen: readonly AgentChildRowModel[]
  history: readonly AgentChildRowModel[]
  running: readonly AgentChildRowModel[]
}): AgentChildRowModel[] {
  const running = new Set(flattenAgentChildRowModels(args.running).map((row) => row.id))
  const newestHistoryFirst = [...args.history].sort(
    (left, right) => (right.settledAt ?? 0) - (left.settledAt ?? 0)
  )
  const seenIds = new Set<string>()
  const merged: AgentChildRowModel[] = []
  for (const row of [...args.seen, ...newestHistoryFirst]) {
    if (running.has(row.id) || seenIds.has(row.id)) {
      continue
    }
    seenIds.add(row.id)
    merged.push(row)
  }
  return merged.slice(0, MAX_FINISHED_BACKGROUND_ROWS)
}
