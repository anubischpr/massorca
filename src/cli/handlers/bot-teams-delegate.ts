import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalPositiveIntegerFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import { withSenderTimeZone } from '../../shared/bot-team-routine-zone'
import { taskStatus, type FilingReply } from '../bot-teams-format'
import { findBot, findBotTeam } from '../bot-teams-lookup'
import { readMessageText } from '../bot-teams-message-input'
import { readBotTeamRoom, readBotTeams } from '../bot-teams-reads'
import { readFinalText } from '../bot-teams-transcript'
import { waitForBotTeamTask } from '../bot-teams-wait'
import { callMarketplaceHost } from './marketplace-host-call'

const DEFAULT_TIMEOUT_SECONDS = 600

/** Files the work with one named bot, as the room's own choice card does, and starts it. */
async function delegate(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const botSelector = getRequiredStringFlag(ctx.flags, 'bot')
  const text = await readMessageText(ctx.flags)
  if (text.trim() === '') {
    throw new RuntimeClientError(
      'invalid_argument',
      'Missing task text: pass --text or --text-stdin.'
    )
  }
  const wait = ctx.flags.get('wait') === true
  const timeoutSeconds =
    getOptionalPositiveIntegerFlag(ctx.flags, 'timeout') ?? DEFAULT_TIMEOUT_SECONDS
  const bot = findBot(findBotTeam(await readBotTeams(ctx), teamId), botSelector)
  const response = await callMarketplaceHost<FilingReply>(
    ctx,
    'botTeams.assignRequest',
    withSenderTimeZone({ teamId, text, botId: bot.id, start: true })
  )
  const task = response.result.task
  if (task === null || task === undefined) {
    throw new RuntimeClientError('runtime_error', `${bot.name} did not take the task.`)
  }
  if (response.result.startError) {
    throw new RuntimeClientError(
      'runtime_error',
      `${bot.name} did not start "${task.title}": ${response.result.startError} The task stays in Todo.`
    )
  }
  const readLater = `Read its result later: orca bot-teams task show --team ${teamId} --task ${task.id}`
  if (!wait) {
    printResult(
      response,
      ctx.json,
      () => `Handed task ${task.id} (${task.title}) to ${bot.name}.\n${readLater}`
    )
    return
  }
  const outcome = await waitForBotTeamTask({
    readRoomTasks: async () => (await readBotTeamRoom(ctx, teamId)).result.tasks,
    taskId: task.id,
    timeoutMs: timeoutSeconds * 1000
  })
  if (outcome.reason === 'timeout') {
    throw new RuntimeClientError(
      'runtime_error',
      `${bot.name} is still running "${task.title}" after ${timeoutSeconds}s. ${readLater}`
    )
  }
  if (outcome.reason === 'awaiting-answer') {
    throw new RuntimeClientError(
      'runtime_error',
      `${bot.name} is waiting for your answer on "${task.title}". Read the room: orca bot-teams messages --team ${teamId}`
    )
  }
  const status = taskStatus(outcome.task)
  const final = await readFinalText(ctx, outcome.task.sessionId)
  if (outcome.task.lastStatus !== 'Done') {
    throw new RuntimeClientError(
      'runtime_error',
      `${bot.name} ended "${task.title}" as ${status}.${final === null ? '' : `\n${final}`}`
    )
  }
  printResult(
    { ...response, result: { ...response.result, final: { status, result: final } } },
    ctx.json,
    () =>
      `${bot.name} finished "${task.title}" (${status}).\n${final ?? 'No final text was written.'}`
  )
}

export const BOT_TEAMS_DELEGATE_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams delegate': delegate
}
