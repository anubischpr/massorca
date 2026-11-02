import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamWebhookAnswer, BotTeamWebhookCall } from './bot-team-webhook-call'
import { listenForBotTeamWebhooks, type BotTeamWebhookListener } from './bot-team-webhook-listener'

let listener: BotTeamWebhookListener | null = null

afterEach(async () => {
  await listener?.close()
  listener = null
})

async function start(
  receive = vi.fn(async (_call: BotTeamWebhookCall): Promise<BotTeamWebhookAnswer> => ({
    status: 202,
    body: { taskId: 'task-1' }
  }))
) {
  listener = await listenForBotTeamWebhooks({ receive, ports: [0] })
  return { receive, baseUrl: listener.baseUrl }
}

describe('the web address listener', () => {
  it('listens on this computer only', async () => {
    const { baseUrl } = await start()
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('hands a POST with its key and text to the receiver and sends its answer', async () => {
    const { receive, baseUrl } = await start()
    const reply = await fetch(`${baseUrl}/hooks/marketing/hook-1`, {
      method: 'POST',
      headers: { Authorization: 'Bearer whsec_abc' },
      body: 'Write the flyer'
    })
    expect(reply.status).toBe(202)
    expect(await reply.json()).toEqual({ taskId: 'task-1' })
    expect(receive).toHaveBeenCalledWith({
      hookId: 'hook-1',
      secret: 'whsec_abc',
      body: 'Write the flyer'
    })
  })

  it('passes no key when the call has none', async () => {
    const { receive, baseUrl } = await start(
      vi.fn(async (): Promise<BotTeamWebhookAnswer> => ({
        status: 401,
        body: { error: 'Not allowed.' }
      }))
    )
    const reply = await fetch(`${baseUrl}/hooks/marketing/hook-1`, { method: 'POST', body: 'x' })
    expect(reply.status).toBe(401)
    expect(receive).toHaveBeenCalledWith({ hookId: 'hook-1', secret: null, body: 'x' })
  })

  it('refuses a body over the limit without asking the receiver', async () => {
    const { receive, baseUrl } = await start()
    const reply = await fetch(`${baseUrl}/hooks/marketing/hook-1`, {
      method: 'POST',
      headers: { Authorization: 'Bearer whsec_abc' },
      body: 'a'.repeat(16 * 1024 + 1)
    })
    expect(reply.status).toBe(413)
    expect(receive).not.toHaveBeenCalled()
  })

  it('answers 404 off the hooks path and 405 for anything but POST', async () => {
    const { receive, baseUrl } = await start()
    expect((await fetch(`${baseUrl}/other`, { method: 'POST', body: 'x' })).status).toBe(404)
    expect((await fetch(`${baseUrl}/hooks/marketing/hook-1`)).status).toBe(405)
    expect(receive).not.toHaveBeenCalled()
  })

  it('tries the next port when the first is taken', async () => {
    const first = await start()
    const port = Number(new URL(first.baseUrl).port)
    const second = await listenForBotTeamWebhooks({ receive: first.receive, ports: [port, 0] })
    try {
      expect(second.baseUrl).not.toBe(first.baseUrl)
    } finally {
      await second.close()
    }
  })
})
