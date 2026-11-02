import { botTeamTaskTitle } from '../../../../shared/bot-team-request-route'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { replyToBotTeamGreeting } from '../../../bot-teams/bot-team-greeting-reply'
import { askDefaultAgentForBotTeamRequest } from '../../../bot-teams/bot-team-request-query'
import { decideBotTeamRequest } from '../../../bot-teams/bot-team-request-flow'
import type { OrchestrationDb } from '../../orchestration/db/orchestration-db'
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
}

export function activeTasksByBot(db: OrchestrationDb, teamId: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of db.listBotTeamTasks(teamId)) {
    if (task.sessionId !== null) {
      counts[task.ownerBotId] = (counts[task.ownerBotId] ?? 0) + 1
    }
  }
  return counts
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
  if (!start) {
    return { message, task, startError: null, ...composite }
  }
  try {
    return { message, task: await startTask(task.id), startError: null, ...composite }
  } catch (error) {
    // The request is kept: the task waits in Todo and can be started again.
    return {
      message,
      task,
      startError: error instanceof Error ? error.message : String(error),
      ...composite
    }
  }
}
