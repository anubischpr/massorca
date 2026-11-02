import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { hostWallTime } from '../../../../../shared/bot-team-routine-schedule'
import {
  BotTeamWebhookSchema,
  type BotTeamWebhook,
  type BotTeamWebhookWithSecret
} from '../../../../../shared/rpc-contract/bot-team-webhook-params'
import type { OrchestrationDb } from '../orchestration-db'

// Plain functions over the database, not methods, so this store stays out of the shared method lists.

const WebhookRow = z.object({
  id: z.string(),
  team_id: z.string(),
  bot_id: z.string(),
  secret_hash: z.string(),
  last_call_at: z.number().nullable()
})
type WebhookRow = z.output<typeof WebhookRow>

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest()

/** A secret has 256 bits of its own, so a plain hash is enough; there is nothing to guess or salt. */
const hashSecret = (secret: string): string => sha256(secret).toString('hex')

function newSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`
}

function toWebhook(row: WebhookRow): BotTeamWebhook {
  return BotTeamWebhookSchema.parse({
    id: row.id,
    teamId: row.team_id,
    botId: row.bot_id,
    lastCall: row.last_call_at === null ? null : hostWallTime(row.last_call_at)
  })
}

function readRow(db: OrchestrationDb, webhookId: string): WebhookRow | undefined {
  const row = db.db.prepare('SELECT * FROM bot_team_webhooks WHERE id = ?').get(webhookId)
  return row === undefined ? undefined : WebhookRow.parse(row)
}

/** The secret is returned once, here; only its hash is stored. */
export function createBotTeamWebhook(
  db: OrchestrationDb,
  input: { teamId: string; botId: string },
  now: number
): BotTeamWebhookWithSecret {
  const bot = db.db
    .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
    .get(input.botId, input.teamId)
  if (bot === undefined) {
    throw new Error(`Bot ${input.botId} is not on team ${input.teamId}.`)
  }
  // Long and random, so the address itself cannot be counted through; the secret is what lets a call in.
  const id = randomBytes(16).toString('hex')
  const secret = newSecret()
  db.db
    .prepare(
      'INSERT INTO bot_team_webhooks (id, team_id, bot_id, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, input.teamId, input.botId, hashSecret(secret), now)
  const row = readRow(db, id)
  if (!row) {
    throw new Error('The web address was not saved.')
  }
  return { webhook: toWebhook(row), secret }
}

export function listBotTeamWebhooks(db: OrchestrationDb, teamId: string): BotTeamWebhook[] {
  return z
    .array(WebhookRow)
    .parse(
      db.db.prepare('SELECT * FROM bot_team_webhooks WHERE team_id = ? ORDER BY rowid').all(teamId)
    )
    .map(toWebhook)
}

/** The old secret stops working in the same statement that stores the new hash. */
export function replaceBotTeamWebhookSecret(
  db: OrchestrationDb,
  webhookId: string
): BotTeamWebhookWithSecret {
  const secret = newSecret()
  const changed = db.db
    .prepare('UPDATE bot_team_webhooks SET secret_hash = ? WHERE id = ?')
    .run(hashSecret(secret), webhookId)
  const row = readRow(db, webhookId)
  if (changed.changes === 0 || !row) {
    throw new Error(`Web address ${webhookId} was not found.`)
  }
  return { webhook: toWebhook(row), secret }
}

// A call to an address that does not exist still pays for one comparison, so timing says nothing.
const NO_SUCH_HASH = Buffer.alloc(32)

export type WebhookVerdict = { ok: true; webhook: BotTeamWebhook } | { ok: false }

/** Compares digests of equal length in constant time; a wrong secret and an unknown address look alike. */
export function verifyBotTeamWebhookSecret(
  db: OrchestrationDb,
  webhookId: string,
  presented: string
): WebhookVerdict {
  const row = readRow(db, webhookId)
  const expected = row ? Buffer.from(row.secret_hash, 'hex') : NO_SUCH_HASH
  const matches = timingSafeEqual(sha256(presented), expected)
  return row && matches ? { ok: true, webhook: toWebhook(row) } : { ok: false }
}

export function noteBotTeamWebhookCall(db: OrchestrationDb, webhookId: string, now: number): void {
  db.db.prepare('UPDATE bot_team_webhooks SET last_call_at = ? WHERE id = ?').run(now, webhookId)
}
