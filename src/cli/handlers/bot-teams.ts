import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import {
  botTeamStatusAwaiting,
  botTeamTaskStatus,
  type BotTeamTaskStatus
} from '../../shared/bot-team-task-status'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamRoutine } from '../../shared/rpc-contract/bot-team-routine-params'

const LATEST_TASK_LIMIT = 5
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type BotTeamRoom = { tasks: BotTeamTask[]; messages: BotTeamMessage[] }

// Why: the CLI has no live session summaries, so a task shows the final status the host kept.
function taskStatus(task: BotTeamTask): BotTeamTaskStatus {
  if (task.lastStatus) {
    return botTeamStatusAwaiting(task.lastStatus, task.awaitingPerson)
  }
  return task.awaitingPerson === true
    ? 'Waiting for you'
    : botTeamTaskStatus(task.sessionId, undefined)
}

function formatTeams(teams: BotTeam[]): string {
  if (teams.length === 0) {
    return 'No Bot teams on this MassOrca host.'
  }
  return teams
    .map((team) => {
      const bots = team.bots.length === 1 ? '1 bot' : `${team.bots.length} bots`
      return `${team.id}  ${team.name}  ${bots}`
    })
    .join('\n')
}

function formatRoom(room: BotTeamRoom): string {
  const latest = [...room.tasks]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, LATEST_TASK_LIMIT)
  return [
    `Tasks: ${room.tasks.length}`,
    `Messages: ${room.messages.length}`,
    ...(latest.length > 0
      ? ['Latest tasks:', ...latest.map((task) => `  - ${task.title} (${taskStatus(task)})`)]
      : [])
  ].join('\n')
}

function describeSchedule(schedule: BotTeamRoutine['schedule']): string {
  const zone = schedule.timeZone ? ` ${schedule.timeZone}` : ''
  if (schedule.frequency === 'daily') {
    return `daily at ${schedule.time}${zone}`
  }
  if (schedule.frequency === 'weekly') {
    return `weekly on ${WEEKDAY_NAMES[schedule.weekday ?? 1]} at ${schedule.time}${zone}`
  }
  if (schedule.frequency === 'monthly') {
    return `monthly on day ${schedule.monthDay ?? 1} at ${schedule.time}${zone}`
  }
  return `once on ${schedule.date ?? 'an unset date'} at ${schedule.time}${zone}`
}

function formatRoutines(routines: BotTeamRoutine[]): string {
  if (routines.length === 0) {
    return 'No routines for this Bot team.'
  }
  return routines
    .map(
      (routine) =>
        `${routine.name}  ${describeSchedule(routine.schedule)}  ${routine.paused ? 'paused' : 'active'}`
    )
    .join('\n')
}

export const BOT_TEAMS_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams list': async ({ client, json }) => {
    const result = await client.call<{ teams: BotTeam[] }>('botTeams.list')
    printResult(result, json, (value) => formatTeams(value.teams))
  },
  'bot-teams room': async (ctx) => {
    const teamId = getRequiredStringFlag(ctx.flags, 'team')
    const result = await ctx.client.call<BotTeamRoom>('botTeams.listRoom', { teamId })
    printResult(result, ctx.json, formatRoom)
  },
  'bot-teams routines': async (ctx) => {
    const teamId = getRequiredStringFlag(ctx.flags, 'team')
    const result = await ctx.client.call<{ routines: BotTeamRoutine[] }>('botTeams.listRoutines', {
      teamId
    })
    printResult(result, ctx.json, (value) => formatRoutines(value.routines))
  }
}
