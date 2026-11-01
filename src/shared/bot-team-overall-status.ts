import type { BotTeamTaskStatus } from './bot-team-task-status'

export type BotTeamOverallStatus = 'Waiting for you' | 'Working' | 'Nothing running'

/** A team's state on its card: what needs the person first, then whether anything is running. */
export function botTeamOverallStatus(statuses: readonly BotTeamTaskStatus[]): BotTeamOverallStatus {
  if (statuses.includes('Waiting for you')) {
    return 'Waiting for you'
  }
  return statuses.includes('Working') ? 'Working' : 'Nothing running'
}
