import type { BotTeamWebhookEndpoint } from '../../shared/rpc-contract/bot-team-webhook-params'

let baseUrl: string | null = null

/** Whether this host takes calls from other apps, and where; on this computer only for now (L41). */
export function botTeamWebhookEndpoint(): BotTeamWebhookEndpoint {
  return baseUrl ? { state: 'ready', baseUrl } : { state: 'unavailable' }
}

export function setBotTeamWebhookBaseUrl(url: string | null): void {
  baseUrl = url
}
