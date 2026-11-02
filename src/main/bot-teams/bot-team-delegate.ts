import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import { botLaunchOptions } from './bot-team-model-choice'
import { botTeamTaskPrompt } from './bot-team-task-start'

export type BotTeamDelegateDeps = {
  fileRequest: (args: {
    title: string
    prompt: string
    agent: BotTeamBot['agent']
    launch?: Readonly<Record<string, string>>
  }) => Promise<string>
  createTask: (args: { title: string; prompt: string; ownerBotId: string }) => BotTeamTask
  linkTask: (taskId: string, requestId: string) => void
  startRequest: (requestId: string, agent: BotTeamBot['agent']) => void
}

/** Hands work to a teammate as a child session. The request is filed first: when it is refused, nothing was changed. */
export async function delegateToBotTeammate(
  deps: BotTeamDelegateDeps,
  { team, botName, text }: { team: BotTeam; botName: string; text: string }
): Promise<BotTeamTask> {
  const teammate = team.bots.find((bot) => bot.name.toLowerCase() === botName.toLowerCase())
  if (!teammate) {
    throw new Error(`${botName} is not on this team. No effects were applied.`)
  }
  const title = botTeamTaskTitle(text, team.bots)
  const launch = botLaunchOptions(teammate)
  const requestId = await deps.fileRequest({
    title,
    prompt: botTeamTaskPrompt(team, teammate, { title, prompt: text }),
    agent: teammate.agent,
    ...(launch ? { launch } : {})
  })
  const task = deps.createTask({ title, prompt: text, ownerBotId: teammate.id })
  deps.linkTask(task.id, requestId)
  deps.startRequest(requestId, teammate.agent)
  return task
}
