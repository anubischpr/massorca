import { describe, expect, it, vi } from 'vitest'
import {
  createMobileBotTeamRoutine,
  listMobileBotTeamRoutineRuns,
  listMobileBotTeamRoutines,
  setMobileBotTeamRoutinePaused
} from './MobileBotTeamRoutineRpc'
import {
  createMobileBotTeamWebhook,
  listMobileBotTeamWebhooks,
  replaceMobileBotTeamWebhookSecret
} from './MobileBotTeamWebhookRpc'

type HostClient = Parameters<typeof listMobileBotTeamRoutines>[0]

const ROUTINE = {
  id: 'r1',
  teamId: 't1',
  botId: 'b1',
  name: 'Monday check-in',
  prompt: 'List what is open.',
  schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
  paused: false,
  nextRun: { date: '2026-11-09', time: '09:00' },
  lastRun: null
}
const HOOK = { id: 'h1', teamId: 't1', botId: 'b1', lastCall: null }

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the calls use only sendRequest.
  return { sendRequest, client: { sendRequest } as unknown as HostClient }
}
const missing = { ok: false, error: { code: 'method_not_found', message: 'nope' } }

describe('routines over the phone', () => {
  it('reads a team’s routines and the runs of one', async () => {
    const list = clientAnswering({ ok: true, result: { routines: [ROUTINE] } })
    expect(await listMobileBotTeamRoutines(list.client, 't1')).toEqual({
      kind: 'ready',
      value: [ROUTINE]
    })
    expect(list.sendRequest).toHaveBeenCalledWith(
      'botTeams.listRoutines',
      { teamId: 't1' },
      expect.anything()
    )
    const run = {
      id: 'k1',
      routineId: 'r1',
      scheduledFor: { date: '2026-11-02', time: '09:00' },
      taskId: 'task1',
      error: null
    }
    const runs = clientAnswering({ ok: true, result: { runs: [run] } })
    expect(await listMobileBotTeamRoutineRuns(runs.client, 'r1')).toEqual({
      kind: 'ready',
      value: [run]
    })
  })

  it('says a host without routines is unsupported, and a reply it cannot read failed', async () => {
    expect(await listMobileBotTeamRoutines(clientAnswering(missing).client, 't1')).toEqual({
      kind: 'unsupported'
    })
    const odd = clientAnswering({ ok: true, result: { routines: [{ id: 'x' }] } })
    expect(await listMobileBotTeamRoutines(odd.client, 't1')).toEqual({ kind: 'failed' })
  })

  it('creates a routine and pauses one, returning what the host kept', async () => {
    const created = clientAnswering({ ok: true, result: { routine: ROUTINE } })
    const input = {
      teamId: 't1',
      botId: 'b1',
      name: 'Monday check-in',
      prompt: 'List what is open.',
      schedule: { frequency: 'weekly' as const, time: '09:00', weekday: 1, monthDay: null }
    }
    expect(await createMobileBotTeamRoutine(created.client, input)).toEqual(ROUTINE)
    expect(created.sendRequest).toHaveBeenCalledWith(
      'botTeams.createRoutine',
      input,
      expect.anything()
    )
    const paused = clientAnswering({ ok: true, result: { routine: { ...ROUTINE, paused: true } } })
    expect(await setMobileBotTeamRoutinePaused(paused.client, 'r1', true)).toMatchObject({
      paused: true
    })
    expect(paused.sendRequest).toHaveBeenCalledWith(
      'botTeams.setRoutinePaused',
      { routineId: 'r1', paused: true },
      expect.anything()
    )
  })

  it('returns null when the host refuses or cannot be reached', async () => {
    const refused = clientAnswering({ ok: false, error: { code: 'bad', message: 'no' } })
    expect(await setMobileBotTeamRoutinePaused(refused.client, 'r1', true)).toBeNull()
    const lost = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the calls use only sendRequest.
    expect(
      await setMobileBotTeamRoutinePaused(lost as unknown as HostClient, 'r1', true)
    ).toBeNull()
  })
})

describe('web addresses over the phone', () => {
  it('lists them with whether the host takes calls', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { webhooks: [HOOK], endpoint: { state: 'unavailable' } }
    })
    expect(await listMobileBotTeamWebhooks(client, 't1')).toEqual({
      kind: 'ready',
      value: { webhooks: [HOOK], endpoint: { state: 'unavailable' } }
    })
    expect(await listMobileBotTeamWebhooks(clientAnswering(missing).client, 't1')).toEqual({
      kind: 'unsupported'
    })
  })

  it('makes an address and replaces its key, each returning the key once', async () => {
    const made = clientAnswering({
      ok: true,
      result: { webhook: HOOK, secret: 'whsec_ONE', endpoint: { state: 'unavailable' } }
    })
    expect(await createMobileBotTeamWebhook(made.client, { teamId: 't1', botId: 'b1' })).toEqual({
      webhook: HOOK,
      secret: 'whsec_ONE',
      endpoint: { state: 'unavailable' }
    })
    expect(made.sendRequest).toHaveBeenCalledWith(
      'botTeams.createWebhook',
      { teamId: 't1', botId: 'b1' },
      expect.anything()
    )
    const replaced = clientAnswering({
      ok: true,
      result: { webhook: HOOK, secret: 'whsec_TWO', endpoint: { state: 'unavailable' } }
    })
    expect(await replaceMobileBotTeamWebhookSecret(replaced.client, 'h1')).toMatchObject({
      secret: 'whsec_TWO'
    })
  })

  it('returns null when the host will not make or replace', async () => {
    const refused = clientAnswering({ ok: false, error: { code: 'bad', message: 'no' } })
    expect(await createMobileBotTeamWebhook(refused.client, { teamId: 't', botId: 'b' })).toBeNull()
    expect(await replaceMobileBotTeamWebhookSecret(refused.client, 'h1')).toBeNull()
  })
})
