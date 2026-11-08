import type { CommandHandler, HandlerContext } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamWebhook,
  BotTeamWebhookEndpoint,
  BotTeamWebhookWithSecret
} from '../../shared/rpc-contract/bot-team-webhook-params'
import { botNameOf, findBot, findBotTeam } from '../bot-teams-lookup'
import { readBotTeams } from '../bot-teams-reads'
import { callMarketplaceHost } from './marketplace-host-call'

type WebhookAnswer = BotTeamWebhookWithSecret & { endpoint: BotTeamWebhookEndpoint }

function endpointLine(endpoint: BotTeamWebhookEndpoint): string {
  return endpoint.state === 'ready'
    ? `Endpoint: ${endpoint.baseUrl}`
    : 'Endpoint: unavailable on this host.'
}

// Why: the host keeps only a hash, so the one reply that makes a secret is the only place it shows.
function secretLine(secret: string): string {
  return `Secret (shown once, store it now): ${secret}`
}

async function listWebhooks(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const response = await callMarketplaceHost<{
    webhooks: BotTeamWebhook[]
    endpoint: BotTeamWebhookEndpoint
  }>(ctx, 'botTeams.listWebhooks', { teamId })
  const teams: BotTeam[] = ctx.json ? [] : await readBotTeams(ctx)
  const team = teams.find((entry) => entry.id === teamId)
  printResult(response, ctx.json, (value) => {
    const lines = value.webhooks.map(
      (hook) =>
        `${hook.id}  ${botNameOf(team, hook.botId)}  ${hook.lastCall ? `last call ${hook.lastCall.date} ${hook.lastCall.time}` : 'never called'}`
    )
    return [
      ...(lines.length > 0 ? lines : ['No web addresses for this team yet.']),
      endpointLine(value.endpoint)
    ].join('\n')
  })
}

async function createWebhook(ctx: HandlerContext): Promise<void> {
  const teamId = getRequiredStringFlag(ctx.flags, 'team')
  const bot = findBot(
    findBotTeam(await readBotTeams(ctx), teamId),
    getRequiredStringFlag(ctx.flags, 'bot')
  )
  const response = await callMarketplaceHost<WebhookAnswer>(ctx, 'botTeams.createWebhook', {
    teamId,
    botId: bot.id
  })
  printResult(response, ctx.json, (value) =>
    [
      `Created web address ${value.webhook.id} for ${bot.name}.`,
      endpointLine(value.endpoint),
      secretLine(value.secret)
    ].join('\n')
  )
}

async function rotateSecret(ctx: HandlerContext): Promise<void> {
  const webhookId = getRequiredStringFlag(ctx.flags, 'webhook')
  const response = await callMarketplaceHost<WebhookAnswer>(ctx, 'botTeams.replaceWebhookSecret', {
    webhookId
  })
  printResult(response, ctx.json, (value) =>
    [
      `Rotated the secret of web address ${value.webhook.id}.`,
      secretLine(value.secret),
      endpointLine(value.endpoint)
    ].join('\n')
  )
}

export const BOT_TEAMS_WEBHOOK_HANDLERS: Record<string, CommandHandler> = {
  'bot-teams webhook list': listWebhooks,
  'bot-teams webhook create': createWebhook,
  'bot-teams webhook rotate-secret': rotateSecret
}
