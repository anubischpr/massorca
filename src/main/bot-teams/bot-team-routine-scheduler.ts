import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import {
  claimDueBotTeamRoutines,
  recordBotTeamRoutineRun,
  type ClaimedBotTeamRoutineRun
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'

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
  startTask: BotTeamRoutineSchedulerDeps['startTask']
): Promise<void> {
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
  recordBotTeamRoutineRun(db, runId, { taskId: task.id, error: null })
  try {
    await startTask(task.id)
  } catch (error) {
    // The task waits in Todo, where the person can start it.
    recordBotTeamRoutineRun(db, runId, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error)
    })
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
    const claimed = claimDueBotTeamRoutines(db, now())
    await Promise.allSettled(claimed.map((claim) => runClaimed(db, claim, deps.startTask)))
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
