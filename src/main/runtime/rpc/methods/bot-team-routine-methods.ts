import {
  BotTeamRoutineCreate,
  BotTeamRoutineList,
  BotTeamRoutineSelector,
  BotTeamRoutineSetPaused
} from '../../../../shared/rpc-contract/bot-team-routine-params'
import {
  createBotTeamRoutine,
  listBotTeamRoutineRuns,
  listBotTeamRoutines,
  setBotTeamRoutinePaused
} from '../../orchestration/db/bot-teams/bot-team-routine-store'
import { defineMethod } from '../core'

export const botTeamListRoutinesMethod = defineMethod({
  name: 'botTeams.listRoutines',
  permission: 'workspace',
  params: BotTeamRoutineList,
  handler: ({ teamId }, { runtime }) => ({
    routines: listBotTeamRoutines(runtime.getOrchestrationDb(), teamId)
  })
})

export const botTeamCreateRoutineMethod = defineMethod({
  name: 'botTeams.createRoutine',
  permission: 'workspace',
  params: BotTeamRoutineCreate,
  handler: (params, { runtime }) => ({
    routine: createBotTeamRoutine(runtime.getOrchestrationDb(), params, Date.now())
  })
})

export const botTeamSetRoutinePausedMethod = defineMethod({
  name: 'botTeams.setRoutinePaused',
  permission: 'workspace',
  params: BotTeamRoutineSetPaused,
  handler: ({ routineId, paused }, { runtime }) => ({
    routine: setBotTeamRoutinePaused(runtime.getOrchestrationDb(), routineId, paused, Date.now())
  })
})

export const botTeamListRoutineRunsMethod = defineMethod({
  name: 'botTeams.listRoutineRuns',
  permission: 'workspace',
  params: BotTeamRoutineSelector,
  handler: ({ routineId }, { runtime }) => ({
    runs: listBotTeamRoutineRuns(runtime.getOrchestrationDb(), routineId)
  })
})

/** Routines run on the host that owns the team, so a client only reads and edits them here. */
export const BOT_TEAM_ROUTINE_METHODS = [
  botTeamListRoutinesMethod,
  botTeamCreateRoutineMethod,
  botTeamSetRoutinePausedMethod,
  botTeamListRoutineRunsMethod
]
