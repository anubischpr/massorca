import { hostWallTime, type HostWallTime } from '../../../src/shared/bot-team-routine-schedule'
import type { BotTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun,
  BotTeamRoutineSchedule
} from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { localTimeZone } from '../../../src/shared/bot-team-routine-zone'

/** Monday first, as the weekday buttons are drawn; the numbers are cron's (0 is Sunday). */
export const MOBILE_ROUTINE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const mobileRoutineWeekdayName = (weekday: number): string => WEEKDAYS[weekday] ?? ''

/** The rule a routine runs by, on the clock of its zone. */
function mobileRoutineRuleLine(schedule: BotTeamRoutineSchedule): string {
  if (schedule.frequency === 'once') {
    return schedule.date
      ? `Once on ${mobileRoutineDateLabel({ date: schedule.date, time: schedule.time })} at ${schedule.time}`
      : `Once at ${schedule.time}`
  }
  if (schedule.frequency === 'weekly') {
    return `Every ${mobileRoutineWeekdayName(schedule.weekday ?? 1)} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Every month on day ${schedule.monthDay ?? 1} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

/** The rule, then the zone it runs in when that is not this device's: its times are on that clock. */
export function mobileRoutineScheduleLine(schedule: BotTeamRoutineSchedule): string {
  const zoneNote =
    schedule.timeZone && schedule.timeZone !== localTimeZone() ? ` (${schedule.timeZone})` : ''
  return `${mobileRoutineRuleLine(schedule)}${zoneNote}`
}

/** A date the host wrote down, drawn as that same day wherever the phone is. */
export function mobileRoutineDateLabel(wall: HostWallTime): string {
  const [year, month, day] = wall.date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${mobileRoutineWeekdayName(weekday).slice(0, 3)} ${day} ${MONTHS[month - 1]}`
}

export const mobileRoutineWhenLabel = (wall: HostWallTime): string =>
  `${mobileRoutineDateLabel(wall)}, ${wall.time}`

/** A moment on this device's clock when the host sent its epoch ms; older hosts send only the wall time. */
export function mobileViewerWall(wall: HostWallTime, at?: number | null): HostWallTime {
  return typeof at === 'number' ? hostWallTime(at) : wall
}

/** A one-time routine whose moment has passed: it is not paused, and it has no next run. */
export function isPastOnceRoutine(
  routine: Pick<BotTeamRoutine, 'paused' | 'nextRun' | 'schedule'>
): boolean {
  return routine.schedule.frequency === 'once' && !routine.paused && routine.nextRun === null
}

/** The next run on a routine's detail screen: its time, "None. It ran once." once a one-time routine has passed, or "Paused.". */
export function mobileRoutineNextRunDetail(
  routine: Pick<BotTeamRoutine, 'paused' | 'nextRun' | 'nextRunAt' | 'schedule'>
): string {
  if (routine.nextRun) {
    return `Next run ${mobileRoutineWhenLabel(mobileViewerWall(routine.nextRun, routine.nextRunAt))}`
  }
  return isPastOnceRoutine(routine) ? 'None. It ran once.' : 'Paused.'
}

/** The last run and the next one, as one line under a routine. */
export function mobileRoutineRunsLine(
  routine: Pick<BotTeamRoutine, 'paused' | 'nextRun' | 'nextRunAt' | 'lastRun' | 'schedule'>,
  lastStatus: string | null
): string {
  if (isPastOnceRoutine(routine)) {
    if (!routine.lastRun) {
      return 'Past. It did not run.'
    }
    const when = mobileRoutineDateLabel(
      mobileViewerWall(routine.lastRun.scheduledFor, routine.lastRun.scheduledAt)
    )
    return lastStatus ? `Done. Ran ${when}, ${lastStatus.toLowerCase()}.` : `Done. Ran ${when}.`
  }
  const next = routine.nextRun
    ? `Next run ${mobileRoutineWhenLabel(mobileViewerWall(routine.nextRun, routine.nextRunAt))}.`
    : 'Paused.'
  if (!routine.lastRun) {
    return `Not run yet. ${next}`
  }
  const when = mobileRoutineDateLabel(
    mobileViewerWall(routine.lastRun.scheduledFor, routine.lastRun.scheduledAt)
  )
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
