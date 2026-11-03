import {
  parseBotTeamClassifyCode,
  parseBotTeamClassifyResearch
} from '../../../../shared/bot-team-request-classify'
import { withoutBotTeamMention } from '../../../../shared/bot-team-request-route'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import { botTeamFilesOnlyText } from '../../../../shared/bot-team-room-attachments-line'
import {
  botTeamRoomTextWithAttachments,
  type BotTeamRoomAttachment
} from '../../../../shared/bot-team-room-attachments'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { activeTasksByBot, fileBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { replyToBotTeamGreeting } from '../../../bot-teams/bot-team-greeting-reply'
import { decideBotTeamRequest } from '../../../bot-teams/bot-team-request-flow'
import { askDefaultAgentForBotTeamRequest } from '../../../bot-teams/bot-team-request-query'
import type { OrchestrationDb } from '../../orchestration/db/orchestration-db'
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
}

/** The person's last few lines in the room: what the language of a line with no words is read from. */
function earlierPersonText(db: OrchestrationDb, teamId: string): string {
  return db
    .listBotTeamMessages(teamId)
    .filter((message) => message.authorBotId === null)
    .slice(-5)
    .map((message) => message.text)
    .join(' ')
}

/** Files the person's line, then lets the one host query decide who takes it. */
export async function postBotTeamRequestOnHost(
  ctx: RpcContext,
  {
    teamId,
    text: typed,
    start,
    askProject = false,
    attachments = []
  }: {
    teamId: string
    text: string
    start: boolean
    askProject?: boolean
    attachments?: BotTeamRoomAttachment[]
  },
  startTask: (taskId: string) => Promise<BotTeamTask>
): Promise<BotTeamPostResult> {
  const db = ctx.runtime.getOrchestrationDb()
  // Files with no words are filed as a request that names them, in the language the person wrote before.
  const text =
    typed.trim() === '' && attachments.length > 0
      ? botTeamFilesOnlyText(attachments, earlierPersonText(db, teamId))
      : typed
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
  // The classify reply also says whether a conversation needs outside knowledge or the project code.
  let classifyReply: string | null = null
  const decision = await decideBotTeamRequest({
    text,
    team,
    otherTeams: teams.filter((entry) => entry.id !== teamId),
    activeTasksByBot: activeTasksByBot(db, teamId),
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
        attachments
      },
      startTask
    )
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
      code: classifyReply !== null && parseBotTeamClassifyCode(classifyReply)
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
      attachments
    },
    startTask
  )
  return {
    message,
    ...filed,
    ...(decision.alsoNeeds.length > 0 && filed.task !== null
      ? { composite: decision.alsoNeeds }
      : {}),
    ...laterFlag
  }
}
