import type {
  BotTeamWebhook,
  BotTeamWebhookEndpoint,
  BotTeamWebhookWithSecret
} from '../../../shared/rpc-contract/bot-team-webhook-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

export type BotTeamWebhookList = { webhooks: BotTeamWebhook[]; endpoint: BotTeamWebhookEndpoint }
export type BotTeamWebhookMade = BotTeamWebhookWithSecret & { endpoint: BotTeamWebhookEndpoint }

/** A host from before web addresses lacks the method: the answer is 'unavailable', not a failure. */
export async function listBotTeamWebhooks(
  teamId: string
): Promise<BotTeamWebhookList | 'unavailable'> {
  try {
    return await call<BotTeamWebhookList>('botTeams.listWebhooks', { teamId })
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** The secret is in this reply only; keep it on screen for the person to copy and nowhere else. */
export function createBotTeamWebhook(input: {
  teamId: string
  botId: string
}): Promise<BotTeamWebhookMade> {
  return call<BotTeamWebhookMade>('botTeams.createWebhook', input)
}

/** The old key stops working at once. */
export function replaceBotTeamWebhookSecret(webhookId: string): Promise<BotTeamWebhookMade> {
  return call<BotTeamWebhookMade>('botTeams.replaceWebhookSecret', { webhookId })
}
