import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import {
  createBotTeamWebhook,
  listBotTeamWebhooks,
  noteBotTeamWebhookCall,
  replaceBotTeamWebhookSecret,
  verifyBotTeamWebhookSecret
} from './bot-team-webhook-store'

const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

describe('bot team web address store', () => {
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
    return { db, team, botId: team.bots[0].id }
  }

  it('makes an address with a secret shown once, and lists it without the secret', () => {
    const { db, team, botId } = setup()
    const { webhook, secret } = createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    expect(secret.length).toBeGreaterThanOrEqual(40)
    expect(webhook).toMatchObject({ teamId: team.id, botId, lastCall: null })
    const listed = listBotTeamWebhooks(db, team.id)
    expect(listed).toEqual([webhook])
    expect(JSON.stringify(listed)).not.toContain(secret)
  })

  it('keeps only a hash of the secret', () => {
    const { db, team, botId } = setup()
    const { webhook, secret } = createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    const stored = JSON.stringify(db.db.prepare('SELECT * FROM bot_team_webhooks').all())
    expect(stored).not.toContain(secret)
    const row = db.db
      .prepare('SELECT secret_hash FROM bot_team_webhooks WHERE id = ?')
      .get(webhook.id) as { secret_hash: string }
    expect(row.secret_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('accepts the secret and nothing else', () => {
    const { db, team, botId } = setup()
    const { webhook, secret } = createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    expect(verifyBotTeamWebhookSecret(db, webhook.id, secret)).toMatchObject({ ok: true })
    for (const wrong of ['', 'x', `${secret}x`, secret.slice(1), secret.toUpperCase()]) {
      expect(verifyBotTeamWebhookSecret(db, webhook.id, wrong)).toEqual({ ok: false })
    }
    expect(verifyBotTeamWebhookSecret(db, 'no-such-address', secret)).toEqual({ ok: false })
  })

  it('makes the old secret useless the moment it is replaced', () => {
    const { db, team, botId } = setup()
    const { webhook, secret } = createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    const replaced = replaceBotTeamWebhookSecret(db, webhook.id)
    expect(replaced.secret).not.toBe(secret)
    expect(replaced.webhook.id).toBe(webhook.id)
    expect(verifyBotTeamWebhookSecret(db, webhook.id, secret)).toEqual({ ok: false })
    expect(verifyBotTeamWebhookSecret(db, webhook.id, replaced.secret)).toMatchObject({ ok: true })
  })

  it('refuses a bot that is not on the team, and replaces nothing that does not exist', () => {
    const { db, team } = setup()
    expect(() => createBotTeamWebhook(db, { teamId: team.id, botId: 'nobody' }, at(11, 2))).toThrow(
      'Bot nobody is not on team'
    )
    expect(() => replaceBotTeamWebhookSecret(db, 'missing')).toThrow('was not found')
  })

  it('notes the last call on the host clock', () => {
    const { db, team, botId } = setup()
    const { webhook } = createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    noteBotTeamWebhookCall(db, webhook.id, at(11, 2, 14, 5))
    expect(listBotTeamWebhooks(db, team.id)[0].lastCall).toEqual({
      date: '2026-11-02',
      time: '14:05'
    })
  })

  it('does not stop a team from being deleted', () => {
    const { db, team, botId } = setup()
    createBotTeamWebhook(db, { teamId: team.id, botId }, at(11, 2))
    expect(() => db.deleteBotTeam(team.id)).not.toThrow()
  })
})
