import type { BotTeamWebhookEndpoint } from './rpc-contract/bot-team-webhook-params'

/** The team's name is for the reader; a call is matched on the id alone, so renaming a team breaks nothing. */
export function botTeamWebhookPath(teamName: string, webhookId: string): string {
  const slug = teamName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `/hooks/${slug || 'team'}/${webhookId}`
}

export function botTeamWebhookAddress(
  endpoint: BotTeamWebhookEndpoint,
  teamName: string,
  webhookId: string
): string {
  const path = botTeamWebhookPath(teamName, webhookId)
  return endpoint.state === 'ready' ? `${endpoint.baseUrl.replace(/\/+$/, '')}${path}` : path
}
