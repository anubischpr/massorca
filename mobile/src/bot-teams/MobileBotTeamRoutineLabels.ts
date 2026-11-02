import type { HostWallTime } from '../../../src/shared/bot-team-routine-schedule'
import type { BotTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun,
  BotTeamRoutineSchedule
} from '../../../src/shared/rpc-contract/bot-team-routine-params'

/** Monday first, as the weekday buttons are drawn; the numbers are cron's (0 is Sunday). */
export const MOBILE_ROUTINE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const mobileRoutineWeekdayName = (weekday: number): string => WEEKDAYS[weekday] ?? ''

export function mobileRoutineScheduleLine(schedule: BotTeamRoutineSchedule): string {
  if (schedule.frequency === 'weekly') {
    return `Every ${mobileRoutineWeekdayName(schedule.weekday ?? 1)} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Every month on day ${schedule.monthDay ?? 1} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

/** A date the host wrote down, drawn as that same day wherever the phone is. */
export function mobileRoutineDateLabel(wall: HostWallTime): string {
  const [year, month, day] = wall.date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${mobileRoutineWeekdayName(weekday).slice(0, 3)} ${day} ${MONTHS[month - 1]}`
}

export const mobileRoutineWhenLabel = (wall: HostWallTime): string =>
  `${mobileRoutineDateLabel(wall)}, ${wall.time}`

/** The last run and the next one, as one line under a routine. */
export function mobileRoutineRunsLine(
  routine: Pick<BotTeamRoutine, 'paused' | 'nextRun' | 'lastRun'>,
  lastStatus: string | null
): string {
  const next = routine.nextRun ? `Next run ${mobileRoutineWhenLabel(routine.nextRun)}.` : 'Paused.'
  if (!routine.lastRun) {
    return `Not run yet. ${next}`
  }
  const when = mobileRoutineDateLabel(routine.lastRun.scheduledFor)
  return `Last run ${when}${lastStatus ? `, ${lastStatus.toLowerCase()}` : ''}. ${next}`
}

/** What became of a run's task, or null while that is not known. A task that never started says so. */
export function mobileRoutineRunStatus(
  run: Pick<BotTeamRoutineRun, 'taskId'>,
  task: BotTeamTask | undefined,
  statusOf: (task: BotTeamTask) => BotTeamTaskStatus
): string | null {
  if (run.taskId === null) {
    return 'Did not start'
  }
  return task ? statusOf(task) : null
}
