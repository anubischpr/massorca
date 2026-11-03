import { botAgentPiRuntime } from '../../shared/bot-team-character-art'
import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import { botLaunchOptions } from './bot-team-model-choice'
import { botTeamTaskPrompt, type BotTeamMemoryLines } from './bot-team-task-start'

export type BotTeamDelegateDeps = {
  fileRequest: (args: {
    title: string
    prompt: string
    agent: BotTeamBot['agent']
    launch?: Readonly<Record<string, string>>
    piRuntime?: PiRuntimeSelection
  }) => Promise<string>
  createTask: (args: { title: string; prompt: string; ownerBotId: string }) => BotTeamTask
  linkTask: (taskId: string, requestId: string) => void
  startRequest: (requestId: string, agent: BotTeamBot['agent']) => void
  /** Settles once the request left pending/starting; a request that cannot say is taken as started. */
  launchOutcome?: (requestId: string) => Promise<{ failed: string | null }>
  /** What the team and the teammate remember, as a task's own start would read it. */
  memoryFor?: (botId: string) => BotTeamMemoryLines
}

/** Hands work to a teammate as a child session. The request is filed first: when it is refused, nothing was changed. */
export async function delegateToBotTeammate(
  deps: BotTeamDelegateDeps,
  {
    team,
    botName,
    text,
    project = null,
    roomExcerpt = []
  }: {
    team: BotTeam
    botName: string
    text: string
    /** The caller's project: its brief goes to the teammate, who works on the same project. */
    project?: BotTeamProject | null
    /** The last room messages, so the teammate sees what the others said. */
    roomExcerpt?: readonly string[]
  }
): Promise<BotTeamTask> {
  const teammate = team.bots.find((bot) => bot.name.toLowerCase() === botName.toLowerCase())
  if (!teammate) {
    throw new Error(`${botName} is not on this team. No effects were applied.`)
  }
  const title = botTeamTaskTitle(text, team.bots)
  const launch = botLaunchOptions(teammate)
  const piRuntime = botAgentPiRuntime(teammate.agent)
  const requestId = await deps.fileRequest({
    title,
    prompt: botTeamTaskPrompt(
      team,
      teammate,
      { title, prompt: text },
      { project, memory: deps.memoryFor?.(teammate.id), roomExcerpt, delegated: true }
    ),
    agent: teammate.agent,
    ...(launch ? { launch } : {}),
    ...(piRuntime ? { piRuntime } : {})
  })
  const task = deps.createTask({ title, prompt: text, ownerBotId: teammate.id })
  deps.linkTask(task.id, requestId)
  deps.startRequest(requestId, teammate.agent)
  const outcome = await deps.launchOutcome?.(requestId)
  if (outcome?.failed) {
    // Why: a silent failure let the caller tell the room the work was handed over when it never started.
    throw new Error(
      `${teammate.name} did not start "${title}": ${outcome.failed} The task stays on the board as Not started. Do this part yourself or tell the person in the Conference room that it did not start; do not say it was handed over.`
    )
  }
  return task
}

/** The team a delegation goes to: the caller's own, or another one the caller named. */
export function findDelegationTeam(
  teams: readonly BotTeam[],
  callerTeamId: string,
  teamName?: string
): BotTeam {
  const found = teamName
    ? teams.find((team) => team.name.toLowerCase() === teamName.toLowerCase())
    : teams.find((team) => team.id === callerTeamId)
  if (!found) {
    throw new Error(
      teamName
        ? `${teamName} is not a team here. No effects were applied.`
        : 'This team no longer exists. No effects were applied.'
    )
  }
  return found
}
