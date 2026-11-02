import { describe, expect, it, vi } from 'vitest'
import { deleteMobileBotTeamMemory, listMobileBotTeamMemory } from './mobile-bot-team-memory-rpc'

type HostClient = Parameters<typeof listMobileBotTeamMemory>[0]

const LINE = {
  id: 'memory_1',
  teamId: 'team_1',
  botId: null,
  text: 'Flyers use the colors from the website.',
  source: { kind: 'task', taskTitle: 'Flyer' }
}

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  return { sendRequest, client: { sendRequest } as unknown as HostClient }
}

describe('listMobileBotTeamMemory', () => {
  it('reads the lines the host remembers for the team', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { memory: [LINE] }
    })
    expect(await listMobileBotTeamMemory(client, 'team_1')).toEqual({
      kind: 'ready',
      memory: [LINE]
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.listMemory',
      { teamId: 'team_1' },
      expect.anything()
    )
  })

  it('treats a host without the method as unsupported', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    expect(await listMobileBotTeamMemory(client, 'team_1')).toEqual({ kind: 'unsupported' })
  })

  it('reports a reply it cannot read as failed, never as empty memory', async () => {
    const { client } = clientAnswering({ ok: true, result: { memory: [{ id: 'x' }] } })
    expect(await listMobileBotTeamMemory(client, 'team_1')).toEqual({ kind: 'failed' })
  })

  it('reports a lost connection as failed', async () => {
    const client = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    } as unknown as HostClient
    expect(await listMobileBotTeamMemory(client, 'team_1')).toEqual({ kind: 'failed' })
  })
})

describe('deleteMobileBotTeamMemory', () => {
  it('asks the host to delete the line and reports that it did', async () => {
    const { client, sendRequest } = clientAnswering({ ok: true, result: { deleted: true } })
    expect(await deleteMobileBotTeamMemory(client, 'memory_1')).toBe(true)
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.deleteMemory',
      { memoryId: 'memory_1' },
      expect.anything()
    )
  })

  it('reports a line the host did not delete as not deleted', async () => {
    const { client } = clientAnswering({ ok: true, result: { deleted: false } })
    expect(await deleteMobileBotTeamMemory(client, 'memory_1')).toBe(false)
  })

  it('reports a refused or lost delete as not deleted', async () => {
    const refused = clientAnswering({ ok: false, error: { code: 'internal', message: 'nope' } })
    expect(await deleteMobileBotTeamMemory(refused.client, 'memory_1')).toBe(false)
    const lost = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    } as unknown as HostClient
    expect(await deleteMobileBotTeamMemory(lost, 'memory_1')).toBe(false)
  })
})
