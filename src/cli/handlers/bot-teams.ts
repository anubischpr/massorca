import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalPositiveIntegerFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import { taskStatus } from '../bot-teams-format'
import { botNameOf } from '../bot-teams-lookup'
import { readBotTeamRoom, readBotTeams } from '../bot-teams-reads'
import { readFinalText } from '../bot-teams-transcript'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamRoutine } from '../../shared/rpc-contract/bot-team-routine-params'
import { BOT_TEAMS_ROOM_HANDLERS } from './bot-teams-room'
import { BOT_TEAMS_DELEGATE_HANDLERS } from './bot-teams-delegate'
import { BOT_TEAMS_PROJECT_HANDLERS } from './bot-teams-projects'
import { BOT_TEAMS_ADMIN_HANDLERS } from './bot-teams-admin'
import { BOT_TEAMS_WEBHOOK_HANDLERS } from './bot-teams-webhooks'
import { BOT_TEAMS_ROUTINE_HANDLERS } from './bot-teams-routines'

const LATEST_TASK_LIMIT = 5
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type BotTeamRoom = { tasks: BotTeamTask[]; messages: BotTeamMessage[] }

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

function teamOf(teams: readonly BotTeam[], teamId: string): BotTeam | undefined {
  return teams.find((team) => team.id === teamId)
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? ''
}

function formatMessages(messages: BotTeamMessage[], team: BotTeam | undefined): string {
  if (messages.length === 0) {
    return 'No messages in this room yet.'
  }
  return messages
    .map((message) => {
      const author = message.authorBotId === null ? 'you' : botNameOf(team, message.authorBotId)
      const files = message.attachments?.length
        ? `  [files: ${message.attachments.map((file) => file.name).join(', ')}]`
        : ''
      return `${message.id}  ${author}  ${firstLine(message.text)}${files}`
    })
    .join('\n')
}

function formatTasks(tasks: BotTeamTask[], team: BotTeam | undefined): string {
  if (tasks.length === 0) {
    return 'No tasks in this room yet.'
  }
  return tasks
    .map(
      (task) =>
        `${task.id}  ${taskStatus(task)}  ${botNameOf(team, task.ownerBotId)}  ${task.title}`
    )
    .join('\n')
}

function formatTaskDetail(
  task: BotTeamTask,
  owner: string,
  project: string,
  result: string | null
): string {
  return [
    `${task.title} (${task.id})`,
    `Status: ${taskStatus(task)}`,
    `Owner: ${owner}`,
    `Project: ${project}`,
    ...(result === null ? ['Result: none yet'] : ['Result:', result])
  ].join('\n')
}

async function messagesView(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const limit = getOptionalPositiveIntegerFlag(ctx.flags, 'limit')
  const response = await readBotTeamRoom(ctx, teamId)
  const messages =
    limit === undefined ? response.result.messages : response.result.messages.slice(-limit)
  const teams = ctx.json ? [] : await readBotTeams(ctx)
  printResult({ ...response, result: { ...response.result, messages } }, ctx.json, (value) =>
    formatMessages(value.messages, teamOf(teams, teamId))
  )
}

async function tasksView(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const response = await readBotTeamRoom(ctx, teamId)
  const teams = ctx.json ? [] : await readBotTeams(ctx)
  printResult(response, ctx.json, (value) => formatTasks(value.tasks, teamOf(teams, teamId)))
}

async function taskShow(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  const response = await readBotTeamRoom(ctx, teamId)
  const task = response.result.tasks.find((entry) => entry.id === taskId)
  if (task === undefined) {
    throw new RuntimeClientError('invalid_argument', `No task ${taskId} on this team.`)
  }
  const result = await readFinalText(ctx, task.sessionId)
  const teams = ctx.json ? [] : await readBotTeams(ctx)
  const owner = botNameOf(teamOf(teams, teamId), task.ownerBotId)
  const project =
    response.result.projects.find((entry) => entry.id === task.projectId)?.name ?? 'none'
  printResult({ ...response, result: { task, result } }, ctx.json, (value) =>
    formatTaskDetail(value.task, owner, project, value.result)
  )
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
  },
  'bot-teams messages': messagesView,
  'bot-teams tasks': tasksView,
  'bot-teams task show': taskShow,
  ...BOT_TEAMS_ROOM_HANDLERS,
  ...BOT_TEAMS_DELEGATE_HANDLERS,
  ...BOT_TEAMS_PROJECT_HANDLERS,
  ...BOT_TEAMS_ADMIN_HANDLERS,
  ...BOT_TEAMS_WEBHOOK_HANDLERS,
  ...BOT_TEAMS_ROUTINE_HANDLERS
}
