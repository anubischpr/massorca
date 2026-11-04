import type { BotTeamRoutineSchedule } from '../../../../../shared/bot-team-routine-schedule'
import type { OrchestrationDb } from '../orchestration-db'

export function requireTeamBot(db: OrchestrationDb, teamId: string, botId: string): void {
  const bot = db.db
    .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
    .get(botId, teamId)
  if (bot === undefined) {
    throw new Error(`Bot ${botId} is not on team ${teamId}.`)
  }
}

// A frequency keeps only the day it uses, so a stale day never changes when it runs.
export function keptSchedule(schedule: BotTeamRoutineSchedule): BotTeamRoutineSchedule {
  return {
    frequency: schedule.frequency,
    time: schedule.time,
    weekday: schedule.frequency === 'weekly' ? schedule.weekday : null,
    monthDay: schedule.frequency === 'monthly' ? schedule.monthDay : null,
    date: schedule.frequency === 'once' ? (schedule.date ?? null) : null,
    timeZone: schedule.timeZone ?? null
  }
}
