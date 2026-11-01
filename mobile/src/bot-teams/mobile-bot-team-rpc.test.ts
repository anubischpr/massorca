import { describe, expect, it } from 'vitest'
import { listMobileBotTeams } from './mobile-bot-team-rpc'

const TEAM = {
  id: 'team_1',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [{ id: 'bot_1', name: 'Iris', job: '', agent: 'claude' }]
}

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  return {
    sendRequest: async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply })
  } as unknown as Parameters<typeof listMobileBotTeams>[0]
}

describe('listMobileBotTeams', () => {
  it('reads the teams a host lists', async () => {
    const list = await listMobileBotTeams(clientAnswering({ ok: true, result: { teams: [TEAM] } }))
    expect(list).toEqual({ kind: 'ready', teams: [TEAM] })
  })

  it('treats a host without the method as unsupported, so the app stays on Workspaces', async () => {
    const list = await listMobileBotTeams(
      clientAnswering({
        ok: false,
        error: { code: 'method_not_found', message: 'nope' }
      })
    )
    expect(list).toEqual({ kind: 'unsupported' })
  })

  it('reports a lost connection as failed, never as unsupported', async () => {
    const client = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    } as unknown as Parameters<typeof listMobileBotTeams>[0]
    expect(await listMobileBotTeams(client)).toEqual({ kind: 'failed' })
  })
})
