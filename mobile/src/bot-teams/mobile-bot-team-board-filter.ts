import type { BotTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'

/** The status views of the board, in the desktop Tasks panel's order; Active is the default. */
export const BOARD_STATUS_FILTERS = ['Active', 'Stopped', 'Done'] as const
export type BoardStatusFilter = (typeof BOARD_STATUS_FILTERS)[number]

/** Same tests as the desktop Tasks panel: Active holds everything not finished or stopped. */
const STATUS_TESTS: Record<BoardStatusFilter, (status: BotTeamTaskStatus) => boolean> = {
  Active: (status) => status !== 'Done' && status !== 'Stopped',
  Stopped: (status) => status === 'Stopped',
  Done: (status) => status === 'Done'
}

export function boardStatusMatches(filter: BoardStatusFilter, status: BotTeamTaskStatus): boolean {
  return STATUS_TESTS[filter](status)
}

/** The project filter ids: every project, one project, or the tasks with none. */
export const BOARD_ALL_PROJECTS = 'all'
export const BOARD_NO_PROJECT = 'none'

export function boardProjectFilterId(projectId: string): string {
  return `project:${projectId}`
}

export function boardTaskInProject(task: BotTeamTask, filter: string): boolean {
  if (filter === BOARD_ALL_PROJECTS) {
    return true
  }
  if (filter === BOARD_NO_PROJECT) {
    return task.projectId === null
  }
  return task.projectId !== null && boardProjectFilterId(task.projectId) === filter
}
