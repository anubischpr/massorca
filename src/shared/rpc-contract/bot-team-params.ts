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

const BotDraft = z.object({
  name: requiredString('Missing bot name'),
  job: z.string().trim().default(''),
  agent: z.string().refine(isTuiAgent, { message: 'Unknown agent' })
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
  accessMode: z.enum(AGENT_SESSION_ACCESS_MODES).optional(),
  workspacesEnabled: z.boolean().optional()
})

export const BotTeamAddBot = BotTeamSelector.extend({
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
  agent: z.string().refine(isTuiAgent)
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
