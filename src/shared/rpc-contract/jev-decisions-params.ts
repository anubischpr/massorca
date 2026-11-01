import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const JevDecisionsSaveApiKey = z.object({
  apiKey: requiredString('Invalid API key')
})

export const JevDecisionsSetEnabled = z.object({
  enabled: z.boolean()
})
