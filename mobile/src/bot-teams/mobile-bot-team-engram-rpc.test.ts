import { describe, expect, it, vi } from 'vitest'
import { listMobileBotTeamEngramMemory } from './mobile-bot-team-engram-rpc'

const INPUT = { teamId: 't', projectId: 'p', query: 'worktree' }

describe('listMobileBotTeamEngramMemory', () => {
  it('passes the project and query to the host and returns its reply', async () => {
    const reply = {
      status: 'ok',
      projectName: 'demo',
      memories: [{ id: '1', title: 'A', excerpt: 'b' }]
    }
    const sendRequest = vi.fn(async () => ({ ok: true, result: reply }))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The call only uses sendRequest.
    expect(await listMobileBotTeamEngramMemory({ sendRequest } as never, INPUT)).toEqual(reply)
    expect(sendRequest).toHaveBeenCalledWith('botTeams.listEngramMemory', INPUT, expect.anything())
  })

  it('reads a host without the method as unavailable, and trouble as failed', async () => {
    const missing = {
      sendRequest: async () => ({ ok: false, error: { code: 'method_not_found', message: 'x' } })
    }
    const broken = { sendRequest: async () => ({ ok: true, result: { nonsense: 1 } }) }
    const thrown = {
      sendRequest: async () => {
        throw new Error('offline')
      }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The call only uses sendRequest.
    const as = (client: unknown) => client as never
    expect((await listMobileBotTeamEngramMemory(as(missing), INPUT)).status).toBe('unavailable')
    expect((await listMobileBotTeamEngramMemory(as(broken), INPUT)).status).toBe('failed')
    expect((await listMobileBotTeamEngramMemory(as(thrown), INPUT)).status).toBe('failed')
  })
})
