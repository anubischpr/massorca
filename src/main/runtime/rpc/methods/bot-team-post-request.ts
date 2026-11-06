import {
  parseBotTeamClassifyCode,
  parseBotTeamClassifyResearch
} from '../../../../shared/bot-team-request-classify'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import {
  botTeamRoomTextWithAttachments,
  type BotTeamRoomAttachment
} from '../../../../shared/bot-team-room-attachments'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { botTeamTaskTitle, withoutBotTeamMention } from '../../../../shared/bot-team-request-route'
import {
  activeTasksByBot,
  botTeamRequestText,
  fileBotTeamRequest
} from '../../../bot-teams/bot-team-assign-request'
import { botTeamScheduledReply } from '../../../bot-teams/bot-team-filed-reply'
import { botTeamReplyTarget } from '../../../bot-teams/bot-team-reply-quote'
import { replyToBotTeamGreeting } from '../../../bot-teams/bot-team-greeting-reply'
import { decideBotTeamRequest } from '../../../bot-teams/bot-team-request-flow'
import { answerWaitingBotTeamTask } from '../../../bot-teams/bot-team-task-answer'
import { sendBotTeamTaskFollowUp } from '../../../bot-teams/bot-team-task-session-turns'
import { askDefaultAgentForBotTeamRequest } from '../../../bot-teams/bot-team-request-query'
import type { BotTeamPrototypeChoice } from '../../../../shared/bot-team-prototype-choice'
import { keepBotTeamPrototypeChoice } from '../../../bot-teams/bot-team-task-prototype'
import { isKnownTimeZone } from '../../../../shared/bot-team-routine-zone'
import { createBotTeamRoutine } from '../../orchestration/db/bot-teams/bot-team-routine-store'
import type { RpcContext } from '../core'
import { startBotTeamConversationReply } from './bot-team-conversation-reply'

/** Every field after `startError` is optional, so a client from before it still reads the reply. */
export type BotTeamPostResult = {
  message: BotTeamMessage
  task: BotTeamTask | null
  startError: string | null
  greeted?: true
  /** The room asks the person to choose; nothing was created. */
  choice?: BotTeamRequestChoice
  /** The other bots a composite task has parts for. */
  composite?: string[]
  /** A bot answered a plain conversation in the room; nothing was filed. */
  answered?: true
  /** A bot is answering a plain conversation in the background; its line reaches the room when ready. */
  replying?: { botId: string }
  /** The request went to another team, because the person named it with @. */
  sentTo?: { teamId: string; teamName: string }
  /** The person asked for the work later: it waits in Todo and nothing starts. */
  later?: true
  /** The person named a day: a one-time routine starts the task then, on the host's clock. */
  scheduled?: { routineId: string; date: string; time: string }
}

/** Files the person's line, then lets the one host query decide who takes it. */
export async function postBotTeamRequestOnHost(
  ctx: RpcContext,
  {
    teamId,
    text: typed,
    start,
    askProject = false,
    attachments = [],
    timeZone,
    prototypeChoice,
    replyToMessageId
  }: {
    teamId: string
    text: string
    start: boolean
    askProject?: boolean
    attachments?: BotTeamRoomAttachment[]
    timeZone?: string
    /** The count the person chose on the prototype card; the task that starts reads it from its notes. */
    prototypeChoice?: BotTeamPrototypeChoice
    /** The room message this request replies to; an older client never sends it. */
    replyToMessageId?: string
  },
  startTaskAsFiled: (taskId: string) => Promise<BotTeamTask>
): Promise<BotTeamPostResult> {
  const db = ctx.runtime.getOrchestrationDb()
  const { keep: keepChoice, startKept } = keepBotTeamPrototypeChoice(db, prototypeChoice)
  const startTask = startKept(startTaskAsFiled)
  // Files with no words are filed as a request that names them, in the language the person wrote before.
  const text = botTeamRequestText(db, teamId, typed, attachments)
  const message = db.postBotTeamMessage({ teamId, text, authorBotId: null, attachments })
  // A greeting gets the team's one line and stops here: no query, task or usage.
  if (replyToBotTeamGreeting(db, { teamId, text })) {
    return { message, task: null, startError: null, greeted: true }
  }
  const teams = db.listBotTeams()
  const team = teams.find((entry) => entry.id === teamId)
  if (!team) {
    return { message, task: null, startError: null }
  }
  // A reply quotes the message it answers; a message from another team, or none, quotes nothing.
  const reply =
    replyToMessageId === undefined ? null : botTeamReplyTarget(db, team, replyToMessageId)
  // A reply to a bot's open question goes to that bot's session, not a new task.
  const answered = await answerWaitingBotTeamTask(
    db,
    { sendToSession: sendBotTeamTaskFollowUp },
    { teamId, text: typed, attachments }
  )
  if (answered) {
    return { message, task: answered, startError: null }
  }
  // The classify reply also says whether a conversation needs outside knowledge or the project code.
  let classifyReply: string | null = null
  const decision = await decideBotTeamRequest({
    text,
    team,
    otherTeams: teams.filter((entry) => entry.id !== teamId),
    activeTasksByBot: activeTasksByBot(db, teamId),
    timeZone: timeZone ?? null,
    quotedBot: reply?.bot ?? null,
    classify: async (prompt) => {
      classifyReply = await askDefaultAgentForBotTeamRequest({
        prompt,
        settings: ctx.runtime.getClientSettings(),
        getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers()
      })
      return classifyReply
    }
  })
  const later = 'later' in decision && decision.later === true
  const laterFlag = later ? { later: true as const } : {}
  if (decision.type === 'team') {
    const target = teams.find((entry) => entry.id === decision.teamId)
    const sentTo = { teamId: decision.teamId, teamName: target?.name ?? '' }
    const filed = await fileBotTeamRequest(
      db,
      {
        teamId,
        toTeamId: decision.teamId,
        text: withoutBotTeamMention(text, sentTo.teamName),
        start,
        later,
        askProject: false,
        attachments,
        originMessageId: message.id,
        timeZone: timeZone ?? null
      },
      startTask
    )
    keepChoice(filed.task)
    return { message, ...filed, sentTo }
  }
  if (decision.type === 'choice') {
    return { message, task: null, startError: null, choice: decision.choice, ...laterFlag }
  }
  if (decision.type === 'conversation') {
    // The reply can take a minute, so it runs on: the room shows the bot typing until it lands.
    const started = startBotTeamConversationReply(ctx, {
      team,
      text: botTeamRoomTextWithAttachments(text, attachments),
      subjectBotIds: decision.subjectBotIds,
      research: classifyReply !== null && parseBotTeamClassifyResearch(classifyReply),
      code: classifyReply !== null && parseBotTeamClassifyCode(classifyReply),
      timeZone: timeZone ?? null
    })
    if (!started) {
      return { message, task: null, startError: null }
    }
    started.done.catch(() => {})
    return { message, task: null, startError: null, replying: { botId: started.botId } }
  }
  if (decision.type === 'ask') {
    return { message, task: null, startError: null }
  }
  if (decision.scheduledFor) {
    const { date, time } = decision.scheduledFor
    const routine = createBotTeamRoutine(
      db,
      {
        teamId,
        botId: decision.bot.id,
        name: botTeamTaskTitle(text, team.bots),
        prompt: botTeamRoomTextWithAttachments(text, attachments),
        schedule: {
          frequency: 'once',
          time,
          weekday: null,
          monthDay: null,
          date,
          timeZone: timeZone && isKnownTimeZone(timeZone) ? timeZone : null
        }
      },
      Date.now()
    )
    db.postBotTeamMessage({
      teamId,
      authorBotId: decision.bot.id,
      text: botTeamScheduledReply({ date, time, text })
    })
    return {
      message,
      task: null,
      startError: null,
      later: true,
      scheduled: { routineId: routine.id, date, time }
    }
  }
  const filed = await fileBotTeamRequest(
    db,
    {
      teamId,
      botId: decision.bot.id,
      text,
      alsoNeeds: decision.alsoNeeds,
      start,
      later,
      askProject,
      attachments,
      timeZone: timeZone ?? null,
      ...(reply ? { quote: reply.quote } : {})
    },
    startTask
  )
  keepChoice(filed.task)
  return {
    message,
    ...filed,
    ...(decision.alsoNeeds.length > 0 && filed.task !== null
      ? { composite: decision.alsoNeeds }
      : {}),
    ...laterFlag
  }
}
