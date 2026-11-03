import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import {
  BOT_TEAM_WEBHOOK_MAX_BODY_BYTES,
  type BotTeamWebhookAnswer,
  type BotTeamWebhookCall
} from './bot-team-webhook-call'

/** Fixed first so an address another app saved keeps working across restarts. */
export const BOT_TEAM_WEBHOOK_PORTS = [47_391, 47_392, 47_393, 47_394, 47_395]
const HOST = '127.0.0.1'
const HOOK_PATH = /^\/hooks\/[^/]+\/([^/?#]+)\/?$/

export type BotTeamWebhookListener = { baseUrl: string; close: () => Promise<void> }

type ListenerDeps = {
  receive: (call: BotTeamWebhookCall) => Promise<BotTeamWebhookAnswer>
  ports?: number[]
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Null once the body passes the limit; the rest is drained, not kept. */
function readCappedBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size <= BOT_TEAM_WEBHOOK_MAX_BODY_BYTES) {
        chunks.push(chunk)
      }
    })
    req.on('end', () =>
      resolve(
        size > BOT_TEAM_WEBHOOK_MAX_BODY_BYTES ? null : Buffer.concat(chunks).toString('utf8')
      )
    )
    req.on('error', reject)
  })
}

function bearer(req: IncomingMessage): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '')
  return match ? match[1] : null
}

/**
 * Takes calls to the teams' web addresses on this computer only. The key each address carries is
 * the whole of a call's authority, so the listener only routes and caps; the receiver decides.
 */
export async function listenForBotTeamWebhooks(
  deps: ListenerDeps
): Promise<BotTeamWebhookListener> {
  const server = createServer((req, res) => {
    const hookId = HOOK_PATH.exec(req.url ?? '')?.[1]
    if (!hookId) {
      send(res, 404, { error: 'Not found.' })
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      send(res, 405, { error: 'Use POST.' })
      return
    }
    void readCappedBody(req)
      .then(async (body) => {
        if (body === null) {
          send(res, 413, { error: 'The text is too long.' })
          return
        }
        const answer = await deps.receive({
          hookId: decodeURIComponent(hookId),
          secret: bearer(req),
          body
        })
        send(res, answer.status, answer.body)
      })
      .catch(() => {
        if (!res.headersSent) {
          send(res, 500, { error: 'This call could not be taken.' })
        }
      })
  })

  let lastError: unknown = null
  for (const port of deps.ports ?? BOT_TEAM_WEBHOOK_PORTS) {
    try {
      const bound = await new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, HOST, () => {
          server.off('error', reject)
          const address = server.address()
          resolve(typeof address === 'object' && address ? address.port : port)
        })
      })
      return {
        baseUrl: `http://${HOST}:${bound}`,
        close: () => new Promise((resolve) => server.close(() => resolve()))
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('No port was free for web addresses.')
}
