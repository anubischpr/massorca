import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import type {
  BotTeamBrief,
  BotTeamCodeSource,
  BotTeamProject,
  BotTeamTask
} from '../../shared/rpc-contract/bot-team-room-params'
import { findBot, findBotTeam, findProject } from '../bot-teams-lookup'
import { readJsonInput } from '../bot-teams-message-input'
import { readBotTeamRoom, readBotTeams } from '../bot-teams-reads'
import { callMarketplaceHost } from './marketplace-host-call'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null
}

/** The Brief from --brief-json or --brief-stdin: three lists are required, the markdown is optional. */
function parseBrief(value: unknown): BotTeamBrief {
  const fields = isRecord(value) ? value : {}
  const requirements = stringList(fields.requirements)
  const constraints = stringList(fields.constraints)
  const decisions = stringList(fields.decisions)
  if (requirements === null || constraints === null || decisions === null) {
    throw new RuntimeClientError(
      'invalid_argument',
      'The brief needs requirements, constraints and decisions lists (arrays of text).'
    )
  }
  const markdown = typeof fields.markdown === 'string' ? { markdown: fields.markdown } : {}
  return { requirements, constraints, decisions, ...markdown }
}

function parseCodeSource(value: string): BotTeamCodeSource {
  if (value !== 'repo' && value !== 'folder') {
    throw new RuntimeClientError('invalid_argument', '--source takes repo or folder.')
  }
  return value
}

function linkedTeamIds(flags: Map<string, string | boolean>): string[] | undefined {
  const value = getOptionalStringFlag(flags, 'link-team')
  if (value === undefined) {
    return undefined
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/** The project a `--project` names on this team, by id or name. */
async function projectFlag(ctx: HandlerContext, teamId: string): Promise<BotTeamProject> {
  const room = await readBotTeamRoom(ctx, teamId)
  return findProject(room.result.projects, getRequiredStringFlag(ctx.flags, 'project'))
}

async function createTask(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const bot = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const response = await callMarketplaceHost<{ task: BotTeamTask }>(ctx, 'botTeams.createTask', {
    teamId,
    title: getRequiredStringFlag(ctx.flags, 'title'),
    prompt: getOptionalStringFlag(ctx.flags, 'prompt') ?? '',
    ownerBotId: bot.id
  })
  printResult(
    response,
    ctx.json,
    (value) => `Saved task ${value.task.id} (${value.task.title}) to Todo.`
  )
}

async function startTask(ctx: HandlerContext): Promise<void> {
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  const response = await callMarketplaceHost<{ task: BotTeamTask }>(ctx, 'botTeams.startTask', {
    taskId
  })
  printResult(response, ctx.json, (value) => `Started task ${value.task.id}.`)
}

async function reassignTask(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  const bot = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const response = await callMarketplaceHost<{ task: BotTeamTask; startError: string | null }>(
    ctx,
    'botTeams.reassignTask',
    { taskId, botId: bot.id }
  )
  printResult(response, ctx.json, () => `Gave task ${taskId} to ${bot.name}.`)
}

async function setTaskProject(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  const selector = getRequiredStringFlag(ctx.flags, 'project')
  const project =
    selector === 'none'
      ? null
      : findProject((await readBotTeamRoom(ctx, teamId)).result.projects, selector)
  const response = await callMarketplaceHost<{ task: BotTeamTask }>(
    ctx,
    'botTeams.setTaskProject',
    { taskId, projectId: project?.id ?? null }
  )
  printResult(response, ctx.json, () =>
    project === null
      ? `Removed task ${taskId} from its project.`
      : `Set task ${taskId} to project ${project.name}.`
  )
}

async function createProject(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const codeSource = getOptionalStringFlag(ctx.flags, 'code-source')
  const linked = linkedTeamIds(ctx.flags)
  const response = await callMarketplaceHost<{ project: BotTeamProject }>(
    ctx,
    'botTeams.createProject',
    {
      teamId,
      name: getRequiredStringFlag(ctx.flags, 'name'),
      goal: getOptionalStringFlag(ctx.flags, 'goal') ?? '',
      ...(codeSource !== undefined ? { codeSource: parseCodeSource(codeSource) } : {}),
      ...(linked !== undefined ? { linkedTeamIds: linked } : {})
    }
  )
  printResult(
    response,
    ctx.json,
    (value) => `Created project ${value.project.name} (${value.project.id}).`
  )
}

async function updateProject(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const project = await projectFlag(ctx, teamId)
  const name = getOptionalStringFlag(ctx.flags, 'name')
  const goal = getOptionalStringFlag(ctx.flags, 'goal')
  const linked = linkedTeamIds(ctx.flags)
  if (name === undefined && goal === undefined && linked === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass --name, --goal or --link-team to change the project.'
    )
  }
  const response = await callMarketplaceHost<{ project: BotTeamProject }>(
    ctx,
    'botTeams.updateProject',
    {
      projectId: project.id,
      teamId,
      ...(name !== undefined ? { name } : {}),
      ...(goal !== undefined ? { goal } : {}),
      ...(linked !== undefined ? { linkedTeamIds: linked } : {})
    }
  )
  printResult(
    response,
    ctx.json,
    (value) => `Updated project ${value.project.name} (${value.project.id}).`
  )
}

function setArchived(archived: boolean): CommandHandler {
  return async (ctx) => {
    const teamId = getRequiredStringFlag(ctx.flags, 'team')
    const project = await projectFlag(ctx, teamId)
    const response = await callMarketplaceHost<{ project: BotTeamProject }>(
      ctx,
      'botTeams.archiveProject',
      { projectId: project.id, teamId, archived }
    )
    printResult(
      response,
      ctx.json,
      (value) =>
        `${archived ? 'Archived' : 'Restored'} project ${value.project.name} (${value.project.id}).`
    )
  }
}

async function deleteProject(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const project = await projectFlag(ctx, teamId)
  const response = await callMarketplaceHost<{ deleted: true }>(ctx, 'botTeams.deleteProject', {
    projectId: project.id,
    teamId
  })
  printResult(response, ctx.json, () => `Deleted project ${project.name} (${project.id}).`)
}

async function setBrief(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const input = await readJsonInput(ctx.flags, 'brief')
  if (input === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass the Brief with --brief-json <json> or --brief-stdin.'
    )
  }
  // Checked before the room is read, so a bad Brief never reaches the host.
  const brief = parseBrief(input)
  const project = await projectFlag(ctx, teamId)
  const response = await callMarketplaceHost<{ project: BotTeamProject }>(
    ctx,
    'botTeams.setProjectBrief',
    {
      projectId: project.id,
      goal: getOptionalStringFlag(ctx.flags, 'goal') ?? project.goal,
      brief
    }
  )
  printResult(
    response,
    ctx.json,
    () => `Saved the brief of project ${project.name} (${project.id}).`
  )
}

async function setCodeSource(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const project = await projectFlag(ctx, teamId)
  const codeSource = parseCodeSource(getRequiredStringFlag(ctx.flags, 'source'))
  const response = await callMarketplaceHost<{ project: BotTeamProject }>(
    ctx,
    'botTeams.setProjectCodeSource',
    { projectId: project.id, codeSource }
  )
  printResult(response, ctx.json, () => `Set project ${project.name} to ${codeSource} code.`)
}

async function setWorkspace(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const project = await projectFlag(ctx, teamId)
  const key = getRequiredStringFlag(ctx.flags, 'workspace')
  const workspaceKey = key === 'none' ? null : key
  const response = await callMarketplaceHost<{ project: BotTeamProject }>(
    ctx,
    'botTeams.setProjectWorkspace',
    { projectId: project.id, workspaceKey }
  )
  printResult(response, ctx.json, () =>
    workspaceKey === null
      ? `Unlinked project ${project.name} from its workspace.`
      : `Linked project ${project.name} to workspace ${workspaceKey}.`
  )
}

export const BOT_TEAMS_PROJECT_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams task create': createTask,
  'bot-teams task start': startTask,
  'bot-teams task reassign': reassignTask,
  'bot-teams task set-project': setTaskProject,
  'bot-teams project create': createProject,
  'bot-teams project update': updateProject,
  'bot-teams project archive': setArchived(true),
  'bot-teams project restore': setArchived(false),
  'bot-teams project rm': deleteProject,
  'bot-teams project brief': setBrief,
  'bot-teams project code-source': setCodeSource,
  'bot-teams project workspace': setWorkspace
}
