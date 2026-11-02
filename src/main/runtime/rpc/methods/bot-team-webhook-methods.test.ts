import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { MOBILE_RPC_METHOD_ALLOWLIST } from '../../runtime-rpc/runtime-rpc-mobile-method-allowlist'
import type { RpcContext } from '../core'
import {
  BOT_TEAM_WEBHOOK_METHODS,
  botTeamCreateWebhookMethod,
  botTeamListWebhooksMethod,
  botTeamReplaceWebhookSecretMethod
} from './bot-team-webhook-methods'

describe('botTeams web address methods', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers read only the runtime's database.
    const ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext
    return { team, ctx }
  }

  it('hands out the secret once, when the address is made or its key replaced, never when listed', async () => {
    const { team, ctx } = setup()
    const created = await botTeamCreateWebhookMethod.handler(
      { teamId: team.id, botId: team.bots[0].id },
      ctx
    )
    expect(created.secret).toMatch(/^whsec_/)
    const listed = await botTeamListWebhooksMethod.handler({ teamId: team.id }, ctx)
    expect(listed.webhooks).toEqual([created.webhook])
    expect(JSON.stringify(listed)).not.toContain(created.secret)
    const replaced = await botTeamReplaceWebhookSecretMethod.handler(
      { webhookId: created.webhook.id },
      ctx
    )
    expect(replaced.secret).not.toBe(created.secret)
    expect(replaced.webhook).toEqual(created.webhook)
  })

  it('says the host does not receive calls yet, in every reply', async () => {
    const { team, ctx } = setup()
    const created = await botTeamCreateWebhookMethod.handler(
      { teamId: team.id, botId: team.bots[0].id },
      ctx
    )
    const listed = await botTeamListWebhooksMethod.handler({ teamId: team.id }, ctx)
    expect(created.endpoint).toEqual({ state: 'unavailable' })
    expect(listed.endpoint).toEqual({ state: 'unavailable' })
  })

  it('are workspace methods the phone may call, and need their ids', () => {
    for (const method of BOT_TEAM_WEBHOOK_METHODS) {
      expect(method.permission).toBe('workspace')
      expect(MOBILE_RPC_METHOD_ALLOWLIST.has(method.name)).toBe(true)
    }
    expect(() => botTeamCreateWebhookMethod.params.parse({ teamId: 't' })).toThrow()
    expect(() => botTeamReplaceWebhookSecretMethod.params.parse({})).toThrow()
  })
})
