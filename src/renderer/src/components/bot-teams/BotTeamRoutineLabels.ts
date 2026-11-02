import { translate } from '@/i18n/i18n'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'
import type { HostWallTime } from '../../../../shared/bot-team-routine-schedule'
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

export function routineScheduleLine(schedule: BotTeamRoutineSchedule): string {
  const time = schedule.time
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

export function routineWhenLabel(wall: HostWallTime): string {
  return `${routineDateLabel(wall)}, ${wall.time}`
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
    task.sessionId === null ? undefined : statuses.get(task.sessionId)
  )
  return { label: botTeamTaskLabel(status), glyph: botTeamTaskGlyph(status) }
}

/** The second line of a routine row: the last run and the next one. */
export function routineRunsLine(routine: BotTeamRoutine, lastStatus: string | null): string {
  const next = routine.nextRun
    ? translate('components.botTeams.routineNextRun', 'Next run {{when}}.', {
        when: routineWhenLabel(routine.nextRun)
      })
    : translate('components.botTeams.routinePausedLine', 'Paused.')
  if (!routine.lastRun) {
    return `${translate('components.botTeams.routineNotRunYet', 'Not run yet.')} ${next}`
  }
  const when = routineDateLabel(routine.lastRun.scheduledFor)
  const last = lastStatus
    ? translate('components.botTeams.routineLastRunStatus', 'Last run {{when}}, {{status}}.', {
        when,
        status: lastStatus.toLowerCase()
      })
    : translate('components.botTeams.routineLastRun', 'Last run {{when}}.', { when })
  return `${last} ${next}`
}
