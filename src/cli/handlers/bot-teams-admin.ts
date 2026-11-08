import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime/types'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamMemoryEntry } from '../../shared/rpc-contract/bot-team-memory-params'
import type {
  BotTeamFileVersion,
  BotTeamVersionRestoreResult
} from '../../shared/rpc-contract/bot-team-version-params'
import { botNameOf, findBot, findBotTeam } from '../bot-teams-lookup'
import { readJsonInput } from '../bot-teams-message-input'
import { readBotTeams } from '../bot-teams-reads'
import { callMarketplaceHost } from './marketplace-host-call'

type BotFieldFlags = {
  name?: string
  job?: string
  agent?: string
  modelMode?: string
  model?: string | null
  effort?: string | null
  skills?: string[]
}

const TEAM_TEXT_FIELDS: readonly (readonly [flag: string, key: string])[] = [
  ['name', 'name'],
  ['purpose', 'purpose'],
  ['character', 'character'],
  ['access-mode', 'accessMode']
]

function workspacesFlag(flags: Map<string, string | boolean>): boolean | undefined {
  const value = getOptionalStringFlag(flags, 'workspaces')
  if (value === undefined) {
    return undefined
  }
  if (value !== 'on' && value !== 'off') {
    throw new RuntimeClientError('invalid_argument', '--workspaces takes on or off.')
  }
  return value === 'on'
}

/** The bot fields the flags set; `none` clears a model or effort, and a field left out is not sent. */
function botFieldsFromFlags(flags: Map<string, string | boolean>): BotFieldFlags {
  const fields: BotFieldFlags = {}
  const name = getOptionalStringFlag(flags, 'name')
  const job = getOptionalStringFlag(flags, 'job')
  const agent = getOptionalStringFlag(flags, 'agent')
  const modelMode = getOptionalStringFlag(flags, 'model-mode')
  const model = getOptionalStringFlag(flags, 'model')
  const effort = getOptionalStringFlag(flags, 'effort')
  const skills = getOptionalStringFlag(flags, 'skills')
  if (name !== undefined) {
    fields.name = name
  }
  if (job !== undefined) {
    fields.job = job
  }
  if (agent !== undefined) {
    fields.agent = agent
  }
  if (modelMode !== undefined) {
    fields.modelMode = modelMode
  }
  if (model !== undefined) {
    fields.model = model === 'none' ? null : model
  }
  if (effort !== undefined) {
    fields.effort = effort === 'none' ? null : effort
  }
  if (skills !== undefined) {
    fields.skills = skills
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
  }
  return fields
}

async function createTeam(ctx: HandlerContext): Promise<void> {
  const workspaces = workspacesFlag(ctx.flags)
  const bots = await readJsonInput(ctx.flags, 'bots')
  const response = await callMarketplaceHost<{ team: BotTeam }>(ctx, 'botTeams.create', {
    name: getRequiredStringFlag(ctx.flags, 'name'),
    purpose: getOptionalStringFlag(ctx.flags, 'purpose') ?? '',
    character: getRequiredStringFlag(ctx.flags, 'character'),
    workspacesEnabled: workspaces ?? false,
    ...(bots !== undefined ? { bots } : {})
  })
  printResult(response, ctx.json, (value) => `Created team ${value.team.name} (${value.team.id}).`)
}

async function updateTeam(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const changes: Record<string, unknown> = {}
  for (const [flag, key] of TEAM_TEXT_FIELDS) {
    const value = getOptionalStringFlag(ctx.flags, flag)
    if (value !== undefined) {
      changes[key] = value
    }
  }
  const workspaces = workspacesFlag(ctx.flags)
  if (workspaces !== undefined) {
    changes.workspacesEnabled = workspaces
  }
  if (Object.keys(changes).length === 0) {
    throw new RuntimeClientError('invalid_argument', 'Pass at least one team field to change.')
  }
  const response = await callMarketplaceHost<{ team: BotTeam }>(ctx, 'botTeams.update', {
    teamId,
    ...changes
  })
  printResult(response, ctx.json, (value) => `Updated team ${value.team.name} (${value.team.id}).`)
}

async function removeTeam(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const response = await callMarketplaceHost<{ deleted: true }>(ctx, 'botTeams.delete', { teamId })
  printResult(response, ctx.json, () => `Deleted team ${teamId}.`)
}

async function addBot(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const bot = {
    name: getRequiredStringFlag(ctx.flags, 'name'),
    agent: getRequiredStringFlag(ctx.flags, 'agent'),
    ...botFieldsFromFlags(ctx.flags)
  }
  const response = await callMarketplaceHost<{ team: BotTeam }>(ctx, 'botTeams.addBot', {
    teamId,
    bot
  })
  printResult(response, ctx.json, (value) => `Added bot ${bot.name} to ${value.team.name}.`)
}

async function updateBot(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const current = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const fields = botFieldsFromFlags(ctx.flags)
  const bot = {
    name: current.name,
    job: current.job,
    agent: current.agent,
    modelMode: current.modelMode,
    model: current.model,
    effort: current.effort,
    skills: current.skills,
    ...fields
  }
  const response = await callMarketplaceHost<{ team: BotTeam }>(ctx, 'botTeams.updateBot', {
    teamId,
    botId: current.id,
    bot
  })
  printResult(
    response,
    ctx.json,
    (value) => `Updated bot ${fields.name ?? current.name} on ${value.team.name}.`
  )
}

async function removeBot(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const bot = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const response = await callMarketplaceHost<{ team: BotTeam }>(ctx, 'botTeams.removeBot', {
    teamId,
    botId: bot.id
  })
  printResult(response, ctx.json, (value) => `Removed ${bot.name} from ${value.team.name}.`)
}

function formatMemory(entries: BotTeamMemoryEntry[], team: BotTeam | undefined): string {
  if (entries.length === 0) {
    return 'No team memory yet.'
  }
  return entries
    .map((entry) => `${entry.id}  ${botNameOf(team, entry.botId)}  ${entry.text}`)
    .join('\n')
}

async function listMemory(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const response = await callMarketplaceHost<{ memory: BotTeamMemoryEntry[] }>(
    ctx,
    'botTeams.listMemory',
    { teamId }
  )
  const teams = ctx.json ? [] : await readBotTeams(ctx)
  printResult(response, ctx.json, (value) =>
    formatMemory(
      value.memory,
      teams.find((team) => team.id === teamId)
    )
  )
}

async function removeMemory(ctx: HandlerContext): Promise<void> {
  const memoryId = getRequiredStringFlag(ctx.flags, 'memory')
  const response = await callMarketplaceHost<{ deleted: boolean }>(ctx, 'botTeams.deleteMemory', {
    memoryId
  })
  printResult(response, ctx.json, () => `Deleted memory ${memoryId}.`)
}

async function listFileVersions(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const relativePath = getRequiredStringFlag(ctx.flags, 'path')
  const response = await callMarketplaceHost<{ versions: BotTeamFileVersion[] }>(
    ctx,
    'botTeams.fileVersions',
    { teamId, relativePath }
  )
  printResult(response, ctx.json, (value) =>
    value.versions.length === 0
      ? `No saved versions of ${relativePath}.`
      : value.versions
          .map((entry) => `${entry.version.id}  ${entry.version.label}  ${entry.version.reason}`)
          .join('\n')
  )
}

async function restoreFileVersion(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const relativePath = getRequiredStringFlag(ctx.flags, 'path')
  const versionId = getRequiredStringFlag(ctx.flags, 'version')
  const response = await callMarketplaceHost<{ result: BotTeamVersionRestoreResult }>(
    ctx,
    'botTeams.restoreFileVersion',
    { teamId, versionId, relativePath }
  )
  const outcome = response.result.result
  if (!outcome.ok) {
    throw new RuntimeClientError('runtime_error', outcome.message)
  }
  printResult(response, ctx.json, () => `Restored ${relativePath} to version ${versionId}.`)
}

export const BOT_TEAMS_ADMIN_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams team create': createTeam,
  'bot-teams team update': updateTeam,
  'bot-teams team rm': removeTeam,
  'bot-teams bot add': addBot,
  'bot-teams bot update': updateBot,
  'bot-teams bot rm': removeBot,
  'bot-teams memory list': listMemory,
  'bot-teams memory rm': removeMemory,
  'bot-teams file versions': listFileVersions,
  'bot-teams file restore-version': restoreFileVersion
}
