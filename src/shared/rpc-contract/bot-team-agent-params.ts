import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamAgentPost = z.object({
  text: requiredString('Missing message text')
})

export const BotTeamAgentDelegate = z.object({
  bot: requiredString('Missing bot name'),
  text: requiredString('Missing task text'),
  /** Another team's name: the bot is looked up there, and the task is filed in that team. */
  team: z.string().trim().min(1).optional()
})

export const BotTeamAgentTaskCreate = z.object({
  text: requiredString('Missing task text')
})
