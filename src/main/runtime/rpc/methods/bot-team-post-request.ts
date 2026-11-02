import { botTeamTaskTitle, withoutBotTeamMention } from '../../../../shared/bot-team-request-route'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { activeTasksByBot, assignBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { replyToBotTeamGreeting } from '../../../bot-teams/bot-team-greeting-reply'
import { askDefaultAgentForBotTeamRequest } from '../../../bot-teams/bot-team-request-query'
import { decideBotTeamRequest } from '../../../bot-teams/bot-team-request-flow'
import type { RpcContext } from '../core'

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
  /** The request went to another team, because the person named it with @. */
  sentTo?: { teamId: string; teamName: string }
}

/** Files the person's line, then lets the one host query decide who takes it. */
export async function postBotTeamRequestOnHost(
  ctx: RpcContext,
  { teamId, text, start }: { teamId: string; text: string; start: boolean },
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
  if (decision.type === 'team') {
    const target = teams.find((entry) => entry.id === decision.teamId)
    const sentTo = { teamId: decision.teamId, teamName: target?.name ?? '' }
    const task = assignBotTeamRequest(db, {
      teamId,
      toTeamId: decision.teamId,
      text: withoutBotTeamMention(text, sentTo.teamName)
    })
    return { message, ...(await startFiled(task, start, startTask)), sentTo }
  }
  if (decision.type === 'choice') {
    return { message, task: null, startError: null, choice: decision.choice }
  }
  if (decision.type !== 'task') {
    return { message, task: null, startError: null }
  }
  const task = db.createBotTeamTask({
    teamId,
    title: botTeamTaskTitle(text, team.bots),
    prompt: text,
    ownerBotId: decision.bot.id
  })
  const composite = decision.alsoNeeds.length > 0 ? { composite: decision.alsoNeeds } : {}
  return { message, ...(await startFiled(task, start, startTask)), ...composite }
}

/** Starts a filed task when asked; one that cannot start waits in Todo with the reason. */
export async function startFiled(
  task: BotTeamTask,
  start: boolean,
  startTask: (taskId: string) => Promise<BotTeamTask>
): Promise<{ task: BotTeamTask; startError: string | null }> {
  if (!start) {
    return { task, startError: null }
  }
  try {
    return { task: await startTask(task.id), startError: null }
  } catch (error) {
    return { task, startError: error instanceof Error ? error.message : String(error) }
  }
}
