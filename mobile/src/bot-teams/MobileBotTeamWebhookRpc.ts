import { z } from 'zod'
import {
  BotTeamWebhookEndpointSchema,
  BotTeamWebhookSchema
} from '../../../src/shared/rpc-contract/bot-team-webhook-params'
import { readFromHost, type HostClient } from './MobileBotTeamRoutineRpc'

const ListReply = z.object({
  webhooks: z.array(BotTeamWebhookSchema),
  endpoint: BotTeamWebhookEndpointSchema
})
const MadeReply = z.object({
  webhook: BotTeamWebhookSchema,
  secret: z.string(),
  endpoint: BotTeamWebhookEndpointSchema
})

export type MobileBotTeamWebhookMade = z.output<typeof MadeReply>

export function listMobileBotTeamWebhooks(client: HostClient, teamId: string) {
  return readFromHost(client, 'botTeams.listWebhooks', { teamId }, ListReply)
}

/** The key is in this reply only: keep it on screen for the person to copy and nowhere else. */
export async function createMobileBotTeamWebhook(
  client: HostClient,
  input: { teamId: string; botId: string }
): Promise<MobileBotTeamWebhookMade | null> {
  const read = await readFromHost(client, 'botTeams.createWebhook', input, MadeReply)
  return read.kind === 'ready' ? read.value : null
}

/** The old key stops working at once. */
export async function replaceMobileBotTeamWebhookSecret(
  client: HostClient,
  webhookId: string
): Promise<MobileBotTeamWebhookMade | null> {
  const read = await readFromHost(client, 'botTeams.replaceWebhookSecret', { webhookId }, MadeReply)
  return read.kind === 'ready' ? read.value : null
}
