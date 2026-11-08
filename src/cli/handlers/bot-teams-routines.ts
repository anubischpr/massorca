import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalNumberFlag, getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  type BotTeamRoutineFrequency
} from '../../shared/bot-team-routine-schedule'
import { localTimeZone } from '../../shared/bot-team-routine-zone'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun,
  BotTeamRoutineSchedule
} from '../../shared/rpc-contract/bot-team-routine-params'
import { findBot, findBotTeam, findRoutine } from '../bot-teams-lookup'
import { readBotTeamRoutines, readBotTeams } from '../bot-teams-reads'
import { callMarketplaceHost } from './marketplace-host-call'

function frequencyFrom(value: string): BotTeamRoutineFrequency {
  const match = BOT_TEAM_ROUTINE_FREQUENCIES.find((entry) => entry === value)
  if (match === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--frequency takes daily, weekly, monthly or once.'
    )
  }
  return match
}

async function resolveRoutine(ctx: HandlerContext): Promise<BotTeamRoutine> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  return findRoutine(
    await readBotTeamRoutines(ctx, teamId),
    getRequiredStringFlag(ctx.flags, 'routine')
  )
}

async function createRoutine(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const bot = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const schedule: BotTeamRoutineSchedule = {
    frequency: frequencyFrom(getOptionalStringFlag(ctx.flags, 'frequency') ?? 'daily'),
    time: getRequiredStringFlag(ctx.flags, 'time'),
    weekday: getOptionalNumberFlag(ctx.flags, 'weekday') ?? null,
    monthDay: getOptionalNumberFlag(ctx.flags, 'month-day') ?? null,
    date: getOptionalStringFlag(ctx.flags, 'date') ?? null,
    timeZone: getOptionalStringFlag(ctx.flags, 'zone') ?? localTimeZone()
  }
  const response = await callMarketplaceHost<{ routine: BotTeamRoutine }>(
    ctx,
    'botTeams.createRoutine',
    {
      teamId,
      botId: bot.id,
      name: getRequiredStringFlag(ctx.flags, 'name'),
      prompt: getRequiredStringFlag(ctx.flags, 'prompt'),
      schedule
    }
  )
  printResult(
    response,
    ctx.json,
    (value) => `Created routine ${value.routine.name} (${value.routine.id}).`
  )
}

async function updateRoutine(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const routine = await resolveRoutine(ctx)
  const botSelector = getOptionalStringFlag(ctx.flags, 'bot')
  const botId =
    botSelector === undefined
      ? routine.botId
      : findBot(findBotTeam(await readBotTeams(ctx), teamId), botSelector).id
  const current = routine.schedule
  const frequency = getOptionalStringFlag(ctx.flags, 'frequency')
  const schedule: BotTeamRoutineSchedule = {
    frequency: frequency === undefined ? current.frequency : frequencyFrom(frequency),
    time: getOptionalStringFlag(ctx.flags, 'time') ?? current.time,
    weekday: getOptionalNumberFlag(ctx.flags, 'weekday') ?? current.weekday,
    monthDay: getOptionalNumberFlag(ctx.flags, 'month-day') ?? current.monthDay,
    date: getOptionalStringFlag(ctx.flags, 'date') ?? current.date ?? null,
    timeZone: getOptionalStringFlag(ctx.flags, 'zone') ?? current.timeZone ?? null
  }
  const response = await callMarketplaceHost<{ routine: BotTeamRoutine }>(
    ctx,
    'botTeams.updateRoutine',
    {
      routineId: routine.id,
      botId,
      name: getOptionalStringFlag(ctx.flags, 'name') ?? routine.name,
      prompt: getOptionalStringFlag(ctx.flags, 'prompt') ?? routine.prompt,
      schedule
    }
  )
  printResult(
    response,
    ctx.json,
    (value) => `Updated routine ${value.routine.name} (${value.routine.id}).`
  )
}

async function removeRoutine(ctx: HandlerContext): Promise<void> {
  const routine = await resolveRoutine(ctx)
  const response = await callMarketplaceHost<{ deleted: true }>(ctx, 'botTeams.deleteRoutine', {
    routineId: routine.id
  })
  printResult(response, ctx.json, () => `Deleted routine ${routine.name} (${routine.id}).`)
}

function setPaused(paused: boolean): CommandHandler {
  return async (ctx) => {
    const routine = await resolveRoutine(ctx)
    const response = await callMarketplaceHost<{ routine: BotTeamRoutine }>(
      ctx,
      'botTeams.setRoutinePaused',
      { routineId: routine.id, paused }
    )
    printResult(
      response,
      ctx.json,
      () => `${paused ? 'Paused' : 'Resumed'} routine ${routine.name} (${routine.id}).`
    )
  }
}

function formatRuns(runs: BotTeamRoutineRun[]): string {
  if (runs.length === 0) {
    return 'No runs for this routine yet.'
  }
  return runs
    .map(
      (run) =>
        `${run.scheduledFor.date} ${run.scheduledFor.time}  ${run.taskId ?? 'no task'}${run.error ? `  failed: ${run.error}` : ''}`
    )
    .join('\n')
}

async function listRuns(ctx: HandlerContext): Promise<void> {
  const routine = await resolveRoutine(ctx)
  const response = await callMarketplaceHost<{ runs: BotTeamRoutineRun[] }>(
    ctx,
    'botTeams.listRoutineRuns',
    { routineId: routine.id }
  )
  printResult(response, ctx.json, (value) => formatRuns(value.runs))
}

export const BOT_TEAMS_ROUTINE_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams routine create': createRoutine,
  'bot-teams routine update': updateRoutine,
  'bot-teams routine rm': removeRoutine,
  'bot-teams routine pause': setPaused(true),
  'bot-teams routine resume': setPaused(false),
  'bot-teams routine runs': listRuns
}
