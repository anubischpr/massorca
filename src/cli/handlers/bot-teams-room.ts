import { randomUUID } from 'node:crypto'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import { withSenderTimeZone } from '../../shared/bot-team-routine-zone'
import { describeFiling, type FilingReply } from '../bot-teams-format'
import { findBot, findBotTeam, findNamedTeam, findProject } from '../bot-teams-lookup'
import {
  mergeAttachments,
  parseAttachments,
  parsePrototypeChoice,
  readMessageText
} from '../bot-teams-message-input'
import { readBotTeamRoom, readBotTeams } from '../bot-teams-reads'
import { callMarketplaceHost } from './marketplace-host-call'

async function sendMessage(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const text = await readMessageText(ctx.flags)
  const attachments = parseAttachments(ctx.flags)
  if (text.trim() === '' && attachments.length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Missing message text: pass --text, --text-stdin or --attach.'
    )
  }
  const replyTo = getOptionalStringFlag(ctx.flags, 'reply-to')
  const prototypeChoice = parsePrototypeChoice(ctx.flags)
  const start = ctx.flags.get('no-start') !== true
  const response = await callMarketplaceHost<FilingReply & { message: { id: string } }>(
    ctx,
    'botTeams.postMessage',
    withSenderTimeZone({
      teamId,
      text,
      start,
      askProject: true,
      clientRequestId: randomUUID(),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(replyTo !== undefined ? { replyToMessageId: replyTo } : {}),
      ...(prototypeChoice !== undefined ? { prototypeChoice } : {})
    })
  )
  printResult(response, ctx.json, (value) =>
    [
      `Sent message ${value.message.id}.`,
      ...describeFiling(value, { teamId, messageId: value.message.id, start, later: false })
    ].join('\n')
  )
}

async function answerRequest(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const requestId = getRequiredStringFlag(ctx.flags, 'request')
  const room = await readBotTeamRoom(ctx, teamId)
  const request = room.result.messages.find((message) => message.id === requestId)
  if (request === undefined) {
    throw new RuntimeClientError('invalid_argument', `No message ${requestId} in this team's room.`)
  }
  if (request.authorBotId !== null) {
    throw new RuntimeClientError(
      'invalid_argument',
      `${requestId} is not a request from the person.`
    )
  }
  const botSelector = getOptionalStringFlag(ctx.flags, 'bot')
  const teamToSelector = getOptionalStringFlag(ctx.flags, 'team-to')
  const projectSelector = getOptionalStringFlag(ctx.flags, 'project')
  const teams =
    botSelector === undefined && teamToSelector === undefined ? [] : await readBotTeams(ctx)
  const botId =
    botSelector === undefined ? undefined : findBot(findBotTeam(teams, teamId), botSelector).id
  const toTeamId =
    teamToSelector === undefined ? undefined : findNamedTeam(teams, teamToSelector).id
  const projectId =
    projectSelector === undefined
      ? undefined
      : projectSelector === 'none'
        ? null
        : findProject(room.result.projects, projectSelector).id
  const later = ctx.flags.get('later') === true
  const attachments = mergeAttachments(request.attachments ?? [], parseAttachments(ctx.flags))
  const prototypeChoice = parsePrototypeChoice(ctx.flags)
  const response = await callMarketplaceHost<FilingReply>(
    ctx,
    'botTeams.assignRequest',
    withSenderTimeZone({
      teamId,
      text: request.text,
      start: true,
      ...(later ? { later } : {}),
      ...(botId !== undefined ? { botId } : {}),
      ...(toTeamId !== undefined ? { toTeamId } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(prototypeChoice !== undefined ? { prototypeChoice } : {})
    })
  )
  printResult(response, ctx.json, (value) =>
    describeFiling(value, { teamId, messageId: requestId, start: true, later }).join('\n')
  )
}

export const BOT_TEAMS_ROOM_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams send': sendMessage,
  'bot-teams answer': answerRequest
}
