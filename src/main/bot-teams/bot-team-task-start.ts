import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import { botAgentPiRuntime } from '../../shared/bot-team-character-art'
import { botLaunchOptions } from './bot-team-model-choice'

export type BotTeamTaskStartDeps = {
  /** The team's folder workspace, created the first time a task starts. */
  ensureTeamWorkspace: (team: BotTeam) => Promise<string>
  /**
   * The workspace a linked project's task runs in (its own child worktree for a repo, the folder
   * for a folder project), or null when the linked Workspaces project is gone.
   */
  prepareLinkedWorkspace: (args: {
    projectId: string
    workspaceKey: string
    taskTitle: string
    taskPrompt: string
  }) => Promise<string | null>
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
  const intro = [
    `This task is part of the project "${project.name}". Read its brief before you start.`,
    ...(project.goal ? [`Goal: ${project.goal}`] : [])
  ]
  const { markdown } = project.brief
  if (typeof markdown === 'string') {
    return [...intro, markdown.trim()].filter((line) => line !== '').join('\n')
  }
  const sections: [string, string[]][] = [
    ['Requirements', project.brief.requirements],
    ['Constraints', project.brief.constraints],
    ['Decisions', project.brief.decisions]
  ]
  return [
    ...intro,
    ...sections
      .filter(([, lines]) => lines.length > 0)
      .map(([title, lines]) => `${title}:\n${lines.map((line) => `- ${line}`).join('\n')}`)
  ].join('\n')
}

/** What the person can delete from the Memory page, as the bot reads it when a task starts. */
export type BotTeamMemoryLines = { team: readonly string[]; bot: readonly string[] }

function memoryText(heading: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`${heading}\n${lines.map((line) => `- ${line}`).join('\n')}`] : []
}

export type BotTeamPromptExtras = {
  project?: BotTeamProject | null
  /** What the task's start was saved with: a hand-over, or the bots a composite task needs. */
  notes?: string | null
  memory?: BotTeamMemoryLines
}

export function botTeamTaskPrompt(
  team: BotTeam,
  bot: BotTeamBot,
  task: Pick<BotTeamTask, 'title' | 'prompt'>,
  { project = null, notes = null, memory }: BotTeamPromptExtras = {}
): string {
  const role = bot.job ? `Your job: ${bot.job}.` : ''
  const skills =
    bot.skills.length > 0 ? `Use these skills when they fit: ${bot.skills.join(', ')}.` : ''
  return [
    `You are ${bot.name}, a bot on the ${team.name} team. ${role} ${skills}`.trim(),
    ...(project ? [botTeamProjectBriefText(project)] : []),
    task.prompt || task.title,
    ...(notes ? [notes] : []),
    ...memoryText('What the team remembers (use it, and do not ask again):', memory?.team ?? []),
    ...memoryText(`What ${bot.name} remembers:`, memory?.bot ?? []),
    [
      'This task is already on the board and the room already says you took it. Tell the team in its Conference room when you finish, in one short line: `orca orchestration team-post --text "<line>"`. Do not post for follow-up messages in this chat.',
      'For this team\'s tasks, read the real board with `orca orchestration team-tasks`. Never add this task to the board again; save only separate work for later with `orca orchestration team-task-create --text "<task>"`. To hand work to a teammate, run `orca orchestration team-delegate --bot <name> --text "<task>"`; add `--team <team>` for a bot of another team.',
      'To keep something for later tasks, run `orca orchestration team-remember --text "<what>"`; add `--me` when only you need it, and `--told` when the person asked you to remember it.'
    ].join(' ')
  ].join('\n\n')
}

/** A linked project's workspace id for a session; a gone project fails the start and stays in Todo. */
async function linkedWorkspaceId(
  deps: BotTeamTaskStartDeps,
  project: BotTeamProject,
  workspaceKey: string,
  task: Pick<BotTeamTask, 'title' | 'prompt'>
): Promise<string> {
  const workspaceId = await deps.prepareLinkedWorkspace({
    projectId: project.id,
    workspaceKey,
    taskTitle: task.title,
    taskPrompt: task.prompt
  })
  if (workspaceId === null) {
    throw new Error(
      `The Workspaces project linked to ${project.name} is gone. Link another one or clear the link.`
    )
  }
  return workspaceId
}

/** Starts the owner bot's session for a task that was waiting in Todo. */
export async function startBotTeamTask(
  deps: BotTeamTaskStartDeps,
  { team, task, ...extras }: { team: BotTeam; task: BotTeamTask } & BotTeamPromptExtras
): Promise<BotTeamTask> {
  if (task.sessionId !== null) {
    throw new Error(`Task ${task.id} already started.`)
  }
  const bot = team.bots.find((candidate) => candidate.id === task.ownerBotId)
  if (!bot) {
    throw new Error(`The bot for task ${task.id} is no longer on the team.`)
  }
  const linked = extras.project?.workspace ?? null
  const workspaceId =
    extras.project && linked
      ? await linkedWorkspaceId(deps, extras.project, linked.key, task)
      : await deps.ensureTeamWorkspace(team)
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
  if (!(await deps.sendPrompt(sessionId, botTeamTaskPrompt(team, bot, task, extras)))) {
    throw new Error(`The request for task ${task.id} did not reach the bot.`)
  }
  return deps.linkSession(task.id, sessionId)
}
