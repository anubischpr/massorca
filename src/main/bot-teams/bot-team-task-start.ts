import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import { botAgentPiRuntime } from '../../shared/bot-team-character-art'
import { botLaunchOptions } from './bot-team-model-choice'

export type BotTeamTaskStartDeps = {
  /** The team's folder workspace, created the first time a task starts. */
  ensureTeamWorkspace: (team: BotTeam) => Promise<string>
  createSession: (args: {
    workspaceId: string
    agent: BotTeamBot['agent']
    accessMode: BotTeam['accessMode']
    piRuntime?: 'gentle-shell'
    options?: Readonly<Record<string, string>>
  }) => Promise<string>
  sendPrompt: (sessionId: string, text: string) => Promise<boolean>
  linkSession: (taskId: string, sessionId: string) => BotTeamTask
}

/** The project's goal and brief, which the person wrote for the bots; empty sections are left out. */
function botTeamProjectBriefText(project: BotTeamProject): string {
  const sections: [string, string[]][] = [
    ['Requirements', project.brief.requirements],
    ['Constraints', project.brief.constraints],
    ['Decisions', project.brief.decisions]
  ]
  return [
    `This task is part of the project "${project.name}". Read its brief before you start.`,
    ...(project.goal ? [`Goal: ${project.goal}`] : []),
    ...sections
      .filter(([, lines]) => lines.length > 0)
      .map(([title, lines]) => `${title}:\n${lines.map((line) => `- ${line}`).join('\n')}`)
  ].join('\n')
}

export function botTeamTaskPrompt(
  team: BotTeam,
  bot: BotTeamBot,
  task: Pick<BotTeamTask, 'title' | 'prompt'>,
  project: BotTeamProject | null = null
): string {
  const role = bot.job ? `Your job: ${bot.job}.` : ''
  const skills =
    bot.skills.length > 0 ? `Use these skills when they fit: ${bot.skills.join(', ')}.` : ''
  return [
    `You are ${bot.name}, a bot on the ${team.name} team. ${role} ${skills}`.trim(),
    ...(project ? [botTeamProjectBriefText(project)] : []),
    task.prompt || task.title,
    [
      'Tell the team in its Conference room when you take this on and when you finish, in one short line each: `orca orchestration team-post --text "<line>"`.',
      'For this team\'s tasks, read the real board with `orca orchestration team-tasks`, and save a task for later with `orca orchestration team-task-create --text "<task>"`. To hand work to a teammate, run `orca orchestration team-delegate --bot <name> --text "<task>"`.'
    ].join(' ')
  ].join('\n\n')
}

/** Starts the owner bot's session for a task that was waiting in Todo. */
export async function startBotTeamTask(
  deps: BotTeamTaskStartDeps,
  {
    team,
    task,
    project = null
  }: { team: BotTeam; task: BotTeamTask; project?: BotTeamProject | null }
): Promise<BotTeamTask> {
  if (task.sessionId !== null) {
    throw new Error(`Task ${task.id} already started.`)
  }
  const bot = team.bots.find((candidate) => candidate.id === task.ownerBotId)
  if (!bot) {
    throw new Error(`The bot for task ${task.id} is no longer on the team.`)
  }
  const workspaceId = await deps.ensureTeamWorkspace(team)
  const options = botLaunchOptions(bot)
  const piRuntime = botAgentPiRuntime(bot.agent)
  const sessionId = await deps.createSession({
    workspaceId,
    agent: bot.agent,
    accessMode: team.accessMode,
    ...(piRuntime ? { piRuntime } : {}),
    ...(options ? { options } : {})
  })
  // Linked only once delivered: an undelivered request must keep the task in Todo, with Start.
  if (!(await deps.sendPrompt(sessionId, botTeamTaskPrompt(team, bot, task, project)))) {
    throw new Error(`The request for task ${task.id} did not reach the bot.`)
  }
  return deps.linkSession(task.id, sessionId)
}
