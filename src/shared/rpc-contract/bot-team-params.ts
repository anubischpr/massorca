import { z } from 'zod'
import { AGENT_SESSION_ACCESS_MODES } from '../agent-session-access-mode'
import { isTuiAgent } from '../tui-agent-config'
import { requiredString } from './rpc-param-primitives'

export const BOT_TEAM_CHARACTERS = [
  'square',
  'circle',
  'triangle',
  'hexagon',
  'diamond',
  'blob'
] as const
export type BotTeamCharacter = (typeof BOT_TEAM_CHARACTERS)[number]

export const BOT_MODEL_MODES = ['auto', 'manual'] as const

const BotDraft = z.object({
  name: requiredString('Missing bot name'),
  job: z.string().trim().default(''),
  agent: z.string().refine(isTuiAgent, { message: 'Unknown agent' }),
  // Optional so an older client's save keeps what the bot already has.
  modelMode: z.enum(BOT_MODEL_MODES).optional(),
  model: z.string().trim().min(1).nullable().optional(),
  effort: z.string().trim().min(1).nullable().optional(),
  skills: z.array(z.string().trim().min(1)).max(50).optional()
})

export const BotTeamCreate = z.object({
  name: requiredString('Missing team name'),
  purpose: z.string().trim().default(''),
  character: z.enum(BOT_TEAM_CHARACTERS),
  workspacesEnabled: z.boolean().default(false),
  bots: z.array(BotDraft).default([])
})

export const BotTeamSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamUpdate = BotTeamSelector.extend({
  name: requiredString('Missing team name').optional(),
  purpose: z.string().trim().optional(),
  character: z.enum(BOT_TEAM_CHARACTERS).optional(),
  accessMode: z.enum(AGENT_SESSION_ACCESS_MODES).optional(),
  workspacesEnabled: z.boolean().optional()
})

export const BotTeamAddBot = BotTeamSelector.extend({
  bot: BotDraft
})

export const BotTeamUpdateBot = BotTeamSelector.extend({
  botId: requiredString('Missing bot id'),
  bot: BotDraft
})

export const BotTeamRemoveBot = BotTeamSelector.extend({
  botId: requiredString('Missing bot id')
})

export type BotTeamCreateInput = z.output<typeof BotTeamCreate>
export type BotTeamUpdateInput = z.output<typeof BotTeamUpdate>
export type BotDraftInput = z.output<typeof BotDraft>

export const BotTeamBotSchema = z.object({
  id: z.string(),
  name: z.string(),
  job: z.string(),
  agent: z.string().refine(isTuiAgent),
  // Defaults read a host from before these existed.
  modelMode: z.enum(BOT_MODEL_MODES).default('auto'),
  model: z.string().nullable().default(null),
  effort: z.string().nullable().default(null),
  skills: z.array(z.string()).default([])
})

export const BotTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  character: z.enum(BOT_TEAM_CHARACTERS),
  workspacesEnabled: z.boolean(),
  accessMode: z.enum(AGENT_SESSION_ACCESS_MODES),
  bots: z.array(BotTeamBotSchema)
})

export type BotTeamBot = z.output<typeof BotTeamBotSchema>
export type BotTeam = z.output<typeof BotTeamSchema>
