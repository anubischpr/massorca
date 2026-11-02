import type { BotTeamTaskStatus } from './bot-team-task-status'

export const BOT_TEAM_BOARD_COLUMNS = ['Todo', 'In Progress', 'In Review', 'Done'] as const
export type BotTeamBoardColumn = (typeof BOT_TEAM_BOARD_COLUMNS)[number]

/** Where a task sits on a project board; Stopped and Stuck stay in progress with their label. */
export function botTeamBoardColumn(status: BotTeamTaskStatus): BotTeamBoardColumn {
  switch (status) {
    case 'Not started':
      return 'Todo'
    case 'Waiting for you':
      return 'In Review'
    case 'Done':
      return 'Done'
    case 'Working':
    case 'Stopped':
    case 'Stuck':
      return 'In Progress'
  }
}
