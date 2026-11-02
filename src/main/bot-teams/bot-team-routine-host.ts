import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { startTaskOnHost } from '../runtime/rpc/methods/bot-team-room'
import { createBotTeamRoutineScheduler } from './bot-team-routine-scheduler'

let started = false

/** Runs this host's routines for as long as it is up; a client only edits them. */
export function startBotTeamRoutineScheduler(runtime: OrcaRuntimeService): void {
  if (started) {
    return
  }
  started = true
  createBotTeamRoutineScheduler({
    getDb: () => runtime.getOrchestrationDb(),
    startTask: (taskId) => startTaskOnHost({ runtime }, taskId)
  }).start()
}
