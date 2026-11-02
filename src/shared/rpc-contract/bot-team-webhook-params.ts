import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

/** A moment on the host's clock, so a viewer in another zone shows the host's time. */
const WallTime = z.object({ date: z.string(), time: z.string() })

export const BotTeamWebhookSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  /** The bot each call's task goes to. */
  botId: z.string(),
  lastCall: WallTime.nullable()
})

/**
 * Whether this host receives calls at all. Until a listener is mounted for them it is
 * 'unavailable', and the address and key it hands out cannot be used yet.
 */
export const BotTeamWebhookEndpointSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unavailable') }),
  z.object({ state: z.literal('ready'), baseUrl: z.string() })
])

export const BotTeamWebhookList = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamWebhookCreate = z.object({
  teamId: requiredString('Missing team id'),
  botId: requiredString('Missing bot id')
})

export const BotTeamWebhookSelector = z.object({
  webhookId: requiredString('Missing web address id')
})

export type BotTeamWebhook = z.output<typeof BotTeamWebhookSchema>
export type BotTeamWebhookEndpoint = z.output<typeof BotTeamWebhookEndpointSchema>
/** The secret is in this reply and nowhere else: the host keeps only its hash. */
export type BotTeamWebhookWithSecret = { webhook: BotTeamWebhook; secret: string }
