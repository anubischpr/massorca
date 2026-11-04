import { hostWallTime, nextRoutineRunAfter } from '../../shared/bot-team-routine-schedule'
import {
  BOT_TEAM_SCHEDULED_RUNS_LIMIT,
  type BotTeamScheduledRun,
  type BotTeamScheduledRunsResult
} from '../../shared/rpc-contract/bot-team-scheduled-run-params'
import {
  listBotTeamRoutineRunTimes,
  listBotTeamRoutines
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

/**
 * The routine runs in a window, earliest first, from the same schedule math the scheduler uses. A
 * paused routine has none still to come, but the runs it already made stay in its history.
 */
export function listBotTeamScheduledRuns(
  db: OrchestrationDb,
  query: { from: number; to: number; teamId?: string; includePast?: boolean },
  now: number
): BotTeamScheduledRunsResult {
  const runs: BotTeamScheduledRun[] = []
  const start = Math.max(query.from, now)
  const pastTo = Math.min(query.to, now)
  const teams = db
    .listBotTeams()
    .filter((team) => query.teamId === undefined || team.id === query.teamId)
  for (const team of teams) {
    for (const routine of listBotTeamRoutines(db, team.id)) {
      const bot = team.bots.find((entry) => entry.id === routine.botId)
      if (!bot) {
        continue
      }
      const runAt = (at: number): BotTeamScheduledRun => ({
        routineId: routine.id,
        routineName: routine.name,
        teamId: team.id,
        teamName: team.name,
        botId: bot.id,
        botName: bot.name,
        botAgent: bot.agent,
        projectId: null,
        projectName: null,
        frequency: routine.schedule.frequency,
        at,
        hostTime: hostWallTime(at)
      })
      if (query.includePast === true && query.from < pastTo) {
        for (const at of listBotTeamRoutineRunTimes(db, routine.id, query.from, pastTo)) {
          runs.push(runAt(at))
        }
      }
      if (routine.paused) {
        continue
      }
      // Why: the window is capped at 62 days and routines run at most daily, so the walk stays short.
      for (
        let at = nextRoutineRunAfter(routine.schedule, start - 1);
        at < query.to;
        at = nextRoutineRunAfter(routine.schedule, at)
      ) {
        runs.push(runAt(at))
      }
    }
  }
  runs.sort((a, b) => a.at - b.at)
  return {
    runs: runs.slice(0, BOT_TEAM_SCHEDULED_RUNS_LIMIT),
    truncated: runs.length > BOT_TEAM_SCHEDULED_RUNS_LIMIT
  }
}
