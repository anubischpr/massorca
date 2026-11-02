import { botTeamWebhookEndpoint } from '../../../bot-teams/bot-team-webhook-endpoint'
import {
  BotTeamWebhookCreate,
  BotTeamWebhookList,
  BotTeamWebhookSelector
} from '../../../../shared/rpc-contract/bot-team-webhook-params'
import {
  createBotTeamWebhook,
  listBotTeamWebhooks,
  replaceBotTeamWebhookSecret
} from '../../orchestration/db/bot-teams/bot-team-webhook-store'
import { defineMethod } from '../core'

// Only the two methods that make a secret ever carry one, and they carry it once.

export const botTeamListWebhooksMethod = defineMethod({
  name: 'botTeams.listWebhooks',
  permission: 'workspace',
  params: BotTeamWebhookList,
  handler: ({ teamId }, { runtime }) => ({
    webhooks: listBotTeamWebhooks(runtime.getOrchestrationDb(), teamId),
    endpoint: botTeamWebhookEndpoint()
  })
})

export const botTeamCreateWebhookMethod = defineMethod({
  name: 'botTeams.createWebhook',
  permission: 'workspace',
  params: BotTeamWebhookCreate,
  handler: (params, { runtime }) => ({
    ...createBotTeamWebhook(runtime.getOrchestrationDb(), params, Date.now()),
    endpoint: botTeamWebhookEndpoint()
  })
})

export const botTeamReplaceWebhookSecretMethod = defineMethod({
  name: 'botTeams.replaceWebhookSecret',
  permission: 'workspace',
  params: BotTeamWebhookSelector,
  handler: ({ webhookId }, { runtime }) => ({
    ...replaceBotTeamWebhookSecret(runtime.getOrchestrationDb(), webhookId),
    endpoint: botTeamWebhookEndpoint()
  })
})

export const BOT_TEAM_WEBHOOK_METHODS = [
  botTeamListWebhooksMethod,
  botTeamCreateWebhookMethod,
  botTeamReplaceWebhookSecretMethod
]
