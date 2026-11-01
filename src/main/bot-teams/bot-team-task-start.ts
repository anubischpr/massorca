import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'

export type BotTeamTaskStartDeps = {
  /** The team's folder workspace, created the first time a task starts. */
  ensureTeamWorkspace: (team: BotTeam) => Promise<string>
  createSession: (args: {
    workspaceId: string
    agent: BotTeamBot['agent']
    accessMode: BotTeam['accessMode']
  }) => Promise<string>
  sendPrompt: (sessionId: string, text: string) => Promise<boolean>
  linkSession: (taskId: string, sessionId: string) => BotTeamTask
}

function taskPrompt(team: BotTeam, bot: BotTeamBot, task: BotTeamTask): string {
  const role = bot.job ? `Your job: ${bot.job}.` : ''
  return [
    `You are ${bot.name}, a bot on the ${team.name} team. ${role}`.trim(),
    task.prompt || task.title
  ].join('\n\n')
}

/** Starts the owner bot's session for a task that was waiting in Todo. */
export async function startBotTeamTask(
  deps: BotTeamTaskStartDeps,
  { team, task }: { team: BotTeam; task: BotTeamTask }
): Promise<BotTeamTask> {
  if (task.sessionId !== null) {
    throw new Error(`Task ${task.id} already started.`)
  }
  const bot = team.bots.find((candidate) => candidate.id === task.ownerBotId)
  if (!bot) {
    throw new Error(`The bot for task ${task.id} is no longer on the team.`)
  }
  const workspaceId = await deps.ensureTeamWorkspace(team)
  const sessionId = await deps.createSession({
    workspaceId,
    agent: bot.agent,
    accessMode: team.accessMode
  })
  // Linked only once delivered: an undelivered request must keep the task in Todo, with Start.
  if (!(await deps.sendPrompt(sessionId, taskPrompt(team, bot, task)))) {
    throw new Error(`The request for task ${task.id} did not reach the bot.`)
  }
  return deps.linkSession(task.id, sessionId)
}
