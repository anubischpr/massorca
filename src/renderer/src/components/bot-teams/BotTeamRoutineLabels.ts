import { translate } from '@/i18n/i18n'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'
import { hostWallTime, type HostWallTime } from '../../../../shared/bot-team-routine-schedule'
import { localTimeZone } from '../../../../shared/bot-team-routine-zone'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun,
  BotTeamRoutineSchedule
} from '../../../../shared/rpc-contract/bot-team-routine-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import type { Status } from '@/components/sidebar/StatusIndicator'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

/** Monday first, as the weekday buttons are drawn; the numbers are cron's (0 is Sunday). */
export const ROUTINE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const

// 1 Nov 2026 is a Sunday, so adding the cron number lands on that weekday.
export function routineWeekdayName(weekday: number, style: 'long' | 'short'): string {
  return new Date(Date.UTC(2026, 10, 1 + weekday)).toLocaleDateString(undefined, {
    weekday: style,
    timeZone: 'UTC'
  })
}

/** The routine's zone, named when it is not the viewer's: its times are on that clock. */
function zoneNote(schedule: BotTeamRoutineSchedule): string {
  return schedule.timeZone && schedule.timeZone !== localTimeZone() ? ` (${schedule.timeZone})` : ''
}

export function routineScheduleLine(schedule: BotTeamRoutineSchedule): string {
  return `${routineRuleLine(schedule)}${zoneNote(schedule)}`
}

function routineRuleLine(schedule: BotTeamRoutineSchedule): string {
  const time = schedule.time
  if (schedule.frequency === 'once') {
    return translate('components.botTeams.routineOnceOn', 'Once on {{day}} at {{time}}', {
      day: schedule.date ? routineDateLabel({ date: schedule.date, time }) : '',
      time
    })
  }
  if (schedule.frequency === 'weekly') {
    return translate('components.botTeams.routineEveryWeekday', 'Every {{day}} at {{time}}', {
      day: routineWeekdayName(schedule.weekday ?? 1, 'long'),
      time
    })
  }
  if (schedule.frequency === 'monthly') {
    return translate(
      'components.botTeams.routineEveryMonth',
      'Every month on day {{day}} at {{time}}',
      { day: String(schedule.monthDay ?? 1), time }
    )
  }
  return translate('components.botTeams.routineEveryDay', 'Every day at {{time}}', { time })
}

/** A date the host wrote down, drawn as that same day wherever the viewer is. */
export function routineDateLabel(wall: HostWallTime): string {
  const [year, month, day] = wall.date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  })
}

/** A run's moment on the viewer's clock when the host sent it as a timestamp; older hosts send only the wall time. */
export function viewerWall(wall: HostWallTime, at?: number | null): HostWallTime {
  return typeof at === 'number' ? hostWallTime(at) : wall
}

export function routineWhenLabel(wall: HostWallTime, at?: number | null): string {
  const shown = viewerWall(wall, at)
  return `${routineDateLabel(shown)}, ${shown.time}`
}

export function routineAccessLabel(team: BotTeam): string {
  return team.accessMode === 'full-access'
    ? translate('components.botTeams.settings.fullAccess', 'Full access')
    : translate('components.botTeams.settings.askFirst', 'Ask first')
}

/** What became of a run's task, or null while that is not known. A task that never started says so. */
export function routineRunStatus(
  run: Pick<BotTeamRoutineRun, 'taskId'>,
  tasks: readonly BotTeamTask[],
  statuses: AgentSessionStatusSnapshot
): { label: string; glyph: Status } | null {
  if (run.taskId === null) {
    return {
      label: translate('components.botTeams.routineDidNotStart', 'Did not start'),
      glyph: 'inactive'
    }
  }
  const task = tasks.find((entry) => entry.id === run.taskId)
  if (!task) {
    return null
  }
  const status = botTeamTaskStatus(
    task.sessionId,
    task.sessionId === null ? undefined : statuses.get(task.sessionId),
    task.awaitingPerson === true
  )
  return { label: botTeamTaskLabel(status), glyph: botTeamTaskGlyph(status) }
}

/** One-time routines still ahead, soonest first: the work the team has scheduled. */
export function upcomingOnceRoutines(
  routines: readonly BotTeamRoutine[]
): (BotTeamRoutine & { nextRun: HostWallTime })[] {
  return routines
    .flatMap((routine) =>
      routine.schedule.frequency === 'once' && !routine.paused && routine.nextRun !== null
        ? [{ ...routine, nextRun: routine.nextRun }]
        : []
    )
    .sort((a, b) =>
      `${a.nextRun.date} ${a.nextRun.time}`.localeCompare(`${b.nextRun.date} ${b.nextRun.time}`)
    )
}

/** A one-time routine whose moment has passed: it ran, or it was paused through it. */
export function isPastOnceRoutine(routine: BotTeamRoutine): boolean {
  return routine.schedule.frequency === 'once' && !routine.paused && routine.nextRun === null
}

/** The second line of a routine row: the last run and the next one. */
export function routineRunsLine(routine: BotTeamRoutine, lastStatus: string | null): string {
  if (isPastOnceRoutine(routine)) {
    if (!routine.lastRun) {
      return translate('components.botTeams.routineOncePast', 'Past. It did not run.')
    }
    const when = routineDateLabel(
      viewerWall(routine.lastRun.scheduledFor, routine.lastRun.scheduledAt)
    )
    return lastStatus
      ? translate('components.botTeams.routineOnceDoneStatus', 'Done. Ran {{when}}, {{status}}.', {
          when,
          status: lastStatus.toLowerCase()
        })
      : translate('components.botTeams.routineOnceDone', 'Done. Ran {{when}}.', { when })
  }
  const next = routine.nextRun
    ? translate('components.botTeams.routineNextRun', 'Next run {{when}}.', {
        when: routineWhenLabel(routine.nextRun, routine.nextRunAt)
      })
    : translate('components.botTeams.routinePausedLine', 'Paused.')
  if (!routine.lastRun) {
    return `${translate('components.botTeams.routineNotRunYet', 'Not run yet.')} ${next}`
  }
  const when = routineDateLabel(
    viewerWall(routine.lastRun.scheduledFor, routine.lastRun.scheduledAt)
  )
  const last = lastStatus
    ? translate('components.botTeams.routineLastRunStatus', 'Last run {{when}}, {{status}}.', {
        when,
        status: lastStatus.toLowerCase()
      })
    : translate('components.botTeams.routineLastRun', 'Last run {{when}}.', { when })
  return `${last} ${next}`
}
