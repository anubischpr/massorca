import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamAgentPost = z.object({
  text: requiredString('Missing message text')
})

export const BotTeamAgentTaskCreate = z.object({
  text: requiredString('Missing task text')
})
