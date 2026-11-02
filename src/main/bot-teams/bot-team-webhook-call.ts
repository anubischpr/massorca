import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import {
  noteBotTeamWebhookCall,
  verifyBotTeamWebhookSecret
} from '../runtime/orchestration/db/bot-teams/bot-team-webhook-store'

export const BOT_TEAM_WEBHOOK_MAX_BODY_BYTES = 16 * 1024
const CALLS_PER_WINDOW = 6
const WINDOW_MS = 60_000
const TITLE_MAX_CHARS = 80

export type BotTeamWebhookCall = {
  hookId: string
  /** What the caller presented as its secret; null when it presented none. */
  secret: string | null
  body: string
}

export type BotTeamWebhookAnswer =
  | { status: 202; body: { taskId: string } }
  | { status: 400 | 401 | 410 | 413 | 429 | 503; body: { error: string } }

const refuse = (
  status: 400 | 401 | 410 | 413 | 429 | 503,
  error: string
): BotTeamWebhookAnswer => ({ status, body: { error } })

/** The text a call carries: a JSON object's `text`, or the whole body as plain text. */
function callText(body: string): string | null {
  const trimmed = body.trim()
  if (!trimmed.startsWith('{')) {
    return trimmed
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed !== null && typeof parsed === 'object' && 'text' in parsed) {
      return typeof parsed.text === 'string' ? parsed.text.trim() : null
    }
  } catch {
    // Not JSON: it is plain text that happens to start with a brace.
  }
  return trimmed
}

export type BotTeamWebhookReceiverDeps = {
  getDb: () => OrchestrationDb | null
  /** The same start a person's Start button uses. */
  startTask: (taskId: string) => Promise<unknown>
  now?: () => number
}

/**
 * Decides one call to a team's web address. It is the whole of the authority a call has: nothing
 * here mounts a listener, so a transport that does must hand its request to this and nothing else.
 * It never logs the secret or the text, and answers a wrong secret and an unknown address alike.
 */
export function createBotTeamWebhookReceiver(deps: BotTeamWebhookReceiverDeps) {
  const now = deps.now ?? Date.now
  const recentCalls = new Map<string, number[]>()

  /** Counted only for calls that got in, so strangers cannot lock the owner out. */
  function withinRate(hookId: string): boolean {
    const since = now() - WINDOW_MS
    const recent = (recentCalls.get(hookId) ?? []).filter((at) => at > since)
    if (recent.length >= CALLS_PER_WINDOW) {
      recentCalls.set(hookId, recent)
      return false
    }
    recentCalls.set(hookId, [...recent, now()])
    return true
  }

  return async function receive(call: BotTeamWebhookCall): Promise<BotTeamWebhookAnswer> {
    const db = deps.getDb()
    if (!db) {
      return refuse(503, 'This host is not ready.')
    }
    if (Buffer.byteLength(call.body, 'utf8') > BOT_TEAM_WEBHOOK_MAX_BODY_BYTES) {
      return refuse(413, 'The text is too long.')
    }
    const verdict = verifyBotTeamWebhookSecret(db, call.hookId, call.secret ?? '')
    if (!verdict.ok) {
      return refuse(401, 'Not allowed.')
    }
    if (!withinRate(call.hookId)) {
      return refuse(429, 'Too many calls. Try again in a minute.')
    }
    const text = callText(call.body)
    if (!text) {
      return refuse(400, 'Send the text of the task.')
    }
    const { webhook } = verdict
    const team = db.listBotTeams().find((entry) => entry.id === webhook.teamId)
    if (!team?.bots.some((bot) => bot.id === webhook.botId)) {
      return refuse(410, 'This web address has no bot to take the task.')
    }
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: text.split('\n')[0].slice(0, TITLE_MAX_CHARS),
      prompt: text,
      ownerBotId: webhook.botId
    })
    noteBotTeamWebhookCall(db, webhook.id, now())
    // Not awaited: the caller needs its answer, not the agent. A task that cannot start waits in Todo.
    void deps.startTask(task.id).catch(() => {
      console.warn('[bot-teams] a web address call made a task that could not start')
    })
    return { status: 202, body: { taskId: task.id } }
  }
}
