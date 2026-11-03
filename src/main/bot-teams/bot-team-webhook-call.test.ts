import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import {
  createBotTeamWebhook,
  listBotTeamWebhooks
} from '../runtime/orchestration/db/bot-teams/bot-team-webhook-store'
import {
  BOT_TEAM_WEBHOOK_MAX_BODY_BYTES,
  createBotTeamWebhookReceiver
} from './bot-team-webhook-call'

describe('a call to a team web address', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    vi.restoreAllMocks()
  })

  function setup(startTask = vi.fn(async () => undefined)) {
    db = new OrchestrationDb(':memory:')
    const database = db
    const team = database.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    let clock = new Date(2026, 10, 2, 9, 0).getTime()
    const { webhook, secret } = createBotTeamWebhook(
      database,
      { teamId: team.id, botId: team.bots[0].id },
      clock
    )
    const receive = createBotTeamWebhookReceiver({
      getDb: () => database,
      startTask,
      now: () => clock
    })
    return {
      db: database,
      team,
      webhook,
      secret,
      receive,
      startTask,
      advance: (ms: number) => {
        clock += ms
      }
    }
  }

  it('makes one task for the address bot and starts it, whatever comes after', async () => {
    const { db, team, webhook, secret, receive, startTask } = setup()
    const result = await receive({ hookId: webhook.id, secret, body: 'Check the new price list.' })
    expect(result.status).toBe(202)
    const [task] = db.listBotTeamTasks(team.id)
    expect(task).toMatchObject({
      title: 'Check the new price list.',
      prompt: 'Check the new price list.',
      ownerBotId: team.bots[0].id,
      sessionId: null
    })
    expect(result.body).toEqual({ taskId: task.id })
    expect(startTask).toHaveBeenCalledWith(task.id)
    expect(listBotTeamWebhooks(db, team.id)[0].lastCall).not.toBeNull()
  })

  it('reads the text from a JSON body too', async () => {
    const { db, team, webhook, secret, receive } = setup()
    await receive({ hookId: webhook.id, secret, body: JSON.stringify({ text: 'From the form.' }) })
    expect(db.listBotTeamTasks(team.id)[0].prompt).toBe('From the form.')
  })

  it('answers a wrong secret and an unknown address the same way, and makes nothing', async () => {
    const { db, team, webhook, secret, receive, startTask } = setup()
    const wrong = await receive({ hookId: webhook.id, secret: `${secret}x`, body: 'hi' })
    const none = await receive({ hookId: webhook.id, secret: null, body: 'hi' })
    const unknown = await receive({ hookId: 'nope', secret, body: 'hi' })
    expect(wrong).toEqual({ status: 401, body: { error: 'Not allowed.' } })
    expect(none).toEqual(wrong)
    expect(unknown).toEqual(wrong)
    expect(db.listBotTeamTasks(team.id)).toEqual([])
    expect(startTask).not.toHaveBeenCalled()
  })

  it('refuses a body over the limit before looking at the secret', async () => {
    const { db, team, webhook, secret, receive } = setup()
    const big = 'a'.repeat(BOT_TEAM_WEBHOOK_MAX_BODY_BYTES + 1)
    expect((await receive({ hookId: webhook.id, secret, body: big })).status).toBe(413)
    expect((await receive({ hookId: webhook.id, secret: 'wrong', body: big })).status).toBe(413)
    expect(db.listBotTeamTasks(team.id)).toEqual([])
  })

  it('counts bytes, not characters', async () => {
    const { webhook, secret, receive } = setup()
    const body = 'é'.repeat(BOT_TEAM_WEBHOOK_MAX_BODY_BYTES / 2 + 1)
    expect((await receive({ hookId: webhook.id, secret, body })).status).toBe(413)
  })

  it('refuses an empty call', async () => {
    const { db, team, webhook, secret, receive } = setup()
    expect((await receive({ hookId: webhook.id, secret, body: '   ' })).status).toBe(400)
    expect(
      (await receive({ hookId: webhook.id, secret, body: JSON.stringify({ text: '' }) })).status
    ).toBe(400)
    expect(db.listBotTeamTasks(team.id)).toEqual([])
  })

  it('stops a burst of calls from one address', async () => {
    const { db, team, webhook, secret, receive, advance } = setup()
    const statuses: number[] = []
    for (let call = 0; call < 8; call += 1) {
      statuses.push((await receive({ hookId: webhook.id, secret, body: `call ${call}` })).status)
    }
    expect(statuses.filter((status) => status === 202)).toHaveLength(6)
    expect(statuses.slice(6)).toEqual([429, 429])
    expect(db.listBotTeamTasks(team.id)).toHaveLength(6)
    advance(61_000)
    expect((await receive({ hookId: webhook.id, secret, body: 'later' })).status).toBe(202)
  })

  it('keeps the task in Todo when it cannot start, and still answers that it was accepted', async () => {
    const { db, team, webhook, secret, receive } = setup(
      vi.fn(async () => {
        throw new Error('No login.')
      })
    )
    const result = await receive({ hookId: webhook.id, secret, body: 'Do it.' })
    expect(result.status).toBe(202)
    expect(db.listBotTeamTasks(team.id)[0].sessionId).toBeNull()
  })

  it('answers 410 when the address bot is gone', async () => {
    const { db, webhook, secret, receive, team } = setup()
    db.db.prepare('DELETE FROM bot_team_bots WHERE id = ?').run(team.bots[0].id)
    expect((await receive({ hookId: webhook.id, secret, body: 'hi' })).status).toBe(410)
  })

  it('never writes the secret or the text to a log', async () => {
    const { webhook, secret, receive } = setup()
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {})
    )
    await receive({ hookId: webhook.id, secret, body: 'private words' })
    await receive({ hookId: webhook.id, secret: 'wrong-secret-value', body: 'private words' })
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls))
    for (const needle of [secret, 'wrong-secret-value', 'private words']) {
      expect(logged).not.toContain(needle)
    }
  })

  it('says nothing is receiving while there is no database', async () => {
    const receive = createBotTeamWebhookReceiver({
      getDb: () => null,
      startTask: vi.fn(),
      now: () => 0
    })
    expect((await receive({ hookId: 'a', secret: 'b', body: 'c' })).status).toBe(503)
  })
})
