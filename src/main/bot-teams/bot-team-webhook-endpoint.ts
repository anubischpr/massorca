import type { BotTeamWebhookEndpoint } from '../../shared/rpc-contract/bot-team-webhook-params'

/**
 * Whether this host takes calls from other apps. No listener is mounted for them: the pairing
 * server answers only GET for its web client and the agent-hook server is loopback with its own
 * token. Mounting one means exposing a public route, which is the owner's call (QP6-3); until then
 * the address and key exist, and nothing can use them.
 */
export function botTeamWebhookEndpoint(): BotTeamWebhookEndpoint {
  return { state: 'unavailable' }
}
