import { botTeamClockNote } from '../../shared/bot-team-person-clock'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import {
  claimDueBotTeamRoutines,
  recordBotTeamRoutineRun,
  type ClaimedBotTeamRoutineRun
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'

import {
  describeRoutineRunFailure,
  settleAbandonedBotTeamRoutineRuns
} from './bot-team-routine-run-failure'

const CHECK_EVERY_MS = 30_000

export type BotTeamRoutineSchedulerDeps = {
  /** Null until the host has a database: nothing is due before then. */
  getDb: () => OrchestrationDb | null
  /** The same start a person's Start button uses (`botTeams.startTask`). */
  startTask: (taskId: string) => Promise<unknown>
  now?: () => number
}

async function runClaimed(
  db: OrchestrationDb,
  { runId, routine }: ClaimedBotTeamRoutineRun,
  startTask: BotTeamRoutineSchedulerDeps['startTask'],
  at: number
): Promise<void> {
  let taskId: string | null = null
  let stage = 'The routine’s task could not be created: '
  try {
    const team = db.listBotTeams().find((entry) => entry.id === routine.teamId)
    if (!team?.bots.some((bot) => bot.id === routine.botId)) {
      recordBotTeamRoutineRun(db, runId, {
        taskId: null,
        error: 'The routine’s bot is no longer on the team.'
      })
      return
    }
    const task = db.createBotTeamTask({
      teamId: routine.teamId,
      title: routine.name,
      prompt: routine.prompt,
      ownerBotId: routine.botId
    })
    taskId = task.id
    stage = 'The routine’s task was made but could not be prepared: '
    // The run's own clock, on the routine's zone: "today" in its prompt is the day it runs.
    const clock = botTeamClockNote(at, routine.schedule.timeZone)
    if (clock !== null) {
      db.setBotTeamTaskStartNotes(task.id, clock)
    }
    recordBotTeamRoutineRun(db, runId, { taskId: task.id, error: null })
    stage = ''
    await startTask(task.id)
  } catch (error) {
    // Whatever failed, the run says so; a task already made waits in Todo, where the person can start it.
    const reason = `${stage}${describeRoutineRunFailure(error)}`
    console.warn(`[bot-teams] routine run ${runId} failed`, error)
    try {
      recordBotTeamRoutineRun(db, runId, { taskId, error: reason })
    } catch (recordError) {
      console.warn(`[bot-teams] routine run ${runId} could not record its failure`, recordError)
    }
  }
}

/** Starts each due routine's task on this host's clock; a run missed while asleep happens once, on wake. */
export function createBotTeamRoutineScheduler(deps: BotTeamRoutineSchedulerDeps) {
  const now = deps.now ?? Date.now
  let timer: ReturnType<typeof setInterval> | null = null

  async function tick(): Promise<void> {
    const db = deps.getDb()
    if (!db) {
      return
    }
    const at = now()
    settleAbandonedBotTeamRoutineRuns(db)
    const claimed = claimDueBotTeamRoutines(db, at)
    await Promise.allSettled(claimed.map((claim) => runClaimed(db, claim, deps.startTask, at)))
  }

  return {
    tick,
    start(): void {
      if (timer) {
        return
      }
      const run = (): void => {
        void tick().catch((error: unknown) =>
          console.warn('[bot-teams] a routine check failed', error)
        )
      }
      timer = setInterval(run, CHECK_EVERY_MS)
      timer.unref()
      // A host that was off at the time starts what it missed as soon as it is back.
      run()
    },
    stop(): void {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }
}
