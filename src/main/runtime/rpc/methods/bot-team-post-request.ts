import { withoutBotTeamMention } from '../../../../shared/bot-team-request-route'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { activeTasksByBot, fileBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { replyToBotTeamGreeting } from '../../../bot-teams/bot-team-greeting-reply'
import { decideBotTeamRequest } from '../../../bot-teams/bot-team-request-flow'
import { askDefaultAgentForBotTeamRequest } from '../../../bot-teams/bot-team-request-query'
import type { RpcContext } from '../core'
import { replyToBotTeamConversation } from './bot-team-conversation-reply'

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
  /** The request went to another team, because the person named it with @. */
  sentTo?: { teamId: string; teamName: string }
  /** The person asked for the work later: it waits in Todo and nothing starts. */
  later?: true
}

/** Files the person's line, then lets the one host query decide who takes it. */
export async function postBotTeamRequestOnHost(
  ctx: RpcContext,
  {
    teamId,
    text,
    start,
    askProject = false
  }: { teamId: string; text: string; start: boolean; askProject?: boolean },
  startTask: (taskId: string) => Promise<BotTeamTask>
): Promise<BotTeamPostResult> {
  const db = ctx.runtime.getOrchestrationDb()
  const message = db.postBotTeamMessage({ teamId, text, authorBotId: null })
  // A greeting gets the team's one line and stops here: no query, task or usage.
  if (replyToBotTeamGreeting(db, { teamId, text })) {
    return { message, task: null, startError: null, greeted: true }
  }
  const teams = db.listBotTeams()
  const team = teams.find((entry) => entry.id === teamId)
  if (!team) {
    return { message, task: null, startError: null }
  }
  const decision = await decideBotTeamRequest({
    text,
    team,
    otherTeams: teams.filter((entry) => entry.id !== teamId),
    activeTasksByBot: activeTasksByBot(db, teamId),
    classify: (prompt) =>
      askDefaultAgentForBotTeamRequest({
        prompt,
        settings: ctx.runtime.getClientSettings(),
        getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers()
      })
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
        askProject: false
      },
      startTask
    )
    return { message, ...filed, sentTo }
  }
  if (decision.type === 'choice') {
    return { message, task: null, startError: null, choice: decision.choice, ...laterFlag }
  }
  if (decision.type === 'conversation') {
    const reply = await replyToBotTeamConversation(ctx, {
      team,
      text,
      subjectBotIds: decision.subjectBotIds
    })
    if (reply) {
      return { message, task: null, startError: null, answered: true }
    }
    // No bot could answer, so the person picks who takes it: the room always shows an outcome.
    const [suggested] = decision.subjectBotIds
    return {
      message,
      task: null,
      startError: null,
      choice: { kind: 'new-bot', ...(suggested ? { suggestedBotId: suggested } : {}) },
      ...laterFlag
    }
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
      askProject
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
