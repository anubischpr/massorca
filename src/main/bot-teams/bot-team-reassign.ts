import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

const POSTS_KEPT = 5
const POST_MAX_CHARS = 400

/** What the previous owner said in the room about this task: its posts after the request. */
function previousPosts(db: OrchestrationDb, task: BotTeamTask): string[] {
  const messages = db.listBotTeamMessages(task.teamId)
  const requestAt = messages.findLastIndex(
    (message) => message.authorBotId === null && message.text === task.prompt
  )
  return messages
    .slice(requestAt + 1)
    .filter((message) => message.authorBotId === task.ownerBotId)
    .slice(-POSTS_KEPT)
    .map((message) => message.text.slice(0, POST_MAX_CHARS))
}

function handoverNotes(args: {
  fromBot: string
  fromTeam: string
  started: boolean
  posts: readonly string[]
}): string {
  const { fromBot, fromTeam, started, posts } = args
  const head = `This task was reassigned to you. It was ${fromBot}'s on the ${fromTeam} team.`
  if (!started) {
    return `${head} It had not been started yet.`
  }
  return [
    `${head} ${fromBot} had already started it, so continue from there and do not start over.`,
    ...(posts.length > 0
      ? [`What ${fromBot} posted in the Conference room about it:`, ...posts.map((p) => `- ${p}`)]
      : [])
  ].join('\n')
}

function teamOfBot(teams: readonly BotTeam[], botId: string): BotTeam | undefined {
  return teams.find((team) => team.bots.some((bot) => bot.id === botId))
}

/**
 * Gives a task that is not running to another bot, of this team or another. Only the owner (and the
 * team) change: nothing starts, and the notes it had stay with the handover. The caller checks it is idle.
 */
export function reassignBotTeamTask(
  db: OrchestrationDb,
  { taskId, botId }: { taskId: string; botId: string }
): BotTeamTask {
  const task = db.getBotTeamTask(taskId)
  const teams = db.listBotTeams()
  const to = teamOfBot(teams, botId)
  const toBot = to?.bots.find((bot) => bot.id === botId)
  if (!to || !toBot) {
    throw new Error(`Bot ${botId} was not found.`)
  }
  if (task.ownerBotId === botId) {
    throw new Error(`${toBot.name} already owns this task.`)
  }
  if (db.isBotTeamTaskHandedOff(taskId)) {
    throw new Error('This task is being handed to a teammate. Try again in a moment.')
  }
  const from = teams.find((team) => team.id === task.teamId)
  const fromBot = from?.bots.find((bot) => bot.id === task.ownerBotId)
  const notes = handoverNotes({
    fromBot: fromBot?.name ?? 'Another bot',
    fromTeam: from?.name ?? 'another',
    started: task.sessionId !== null,
    posts: previousPosts(db, task)
  })
  // The notes the task already had (a composite plan, a day it was asked for) stay, before the handover.
  const kept = db.getBotTeamTaskStartNotes(taskId)
  return db.moveBotTeamTask(taskId, {
    teamId: to.id,
    ownerBotId: botId,
    startNotes: kept === null ? notes : `${kept}\n\n${notes}`
  })
}
