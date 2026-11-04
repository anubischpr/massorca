import type { BotTeamRoutine } from './rpc-contract/bot-team-routine-params'

/** A routine that finished its schedule: a Once routine that already ran. It shows under Archived. */
export function isArchivedBotTeamRoutine(
  routine: Pick<BotTeamRoutine, 'schedule' | 'nextRun' | 'lastRun'>
): boolean {
  return (
    routine.schedule.frequency === 'once' && routine.nextRun === null && routine.lastRun !== null
  )
}
