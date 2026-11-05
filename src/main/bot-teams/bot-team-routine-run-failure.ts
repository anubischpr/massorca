import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

const NO_DETAIL = 'No further detail was reported.'

/** What a person reads on a run: a thrown error's message, never an empty line or `[object Object]`. */
export function describeRoutineRunFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.trim()
  return message === '' ? NO_DETAIL : message
}

export const ABANDONED_ROUTINE_RUN_ERROR =
  'This run was claimed, but its task was never created: the host stopped or failed first.'

/**
 * Gives a claimed run that has neither a task nor a reason its reason. A run in flight in another
 * process is unaffected: it records its own outcome right after, over this one.
 */
export function settleAbandonedBotTeamRoutineRuns(db: OrchestrationDb): number {
  const settled = db.db
    .prepare('UPDATE bot_team_routine_runs SET error = ? WHERE task_id IS NULL AND error IS NULL')
    .run(ABANDONED_ROUTINE_RUN_ERROR)
  return Number(settled.changes)
}
