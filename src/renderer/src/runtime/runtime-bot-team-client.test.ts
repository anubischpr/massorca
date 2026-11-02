import { describe, expect, it, vi } from 'vitest'
import { RuntimeRpcCallError } from './runtime-rpc-result'

const callRuntimeRpc = vi.hoisted(() => vi.fn())
vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc }))
vi.mock('./bot-team-host', () => ({
  botTeamHostTarget: () => ({ kind: 'local' }),
  currentBotTeamHost: () => 'local'
}))

const { listBotTeamRoom, setBotTeamProjectCodeSource } = await import('./runtime-bot-team-client')

function failure(code: string): RuntimeRpcCallError {
  return new RuntimeRpcCallError({ id: '1', ok: false, error: { code, message: code } })
}

const PROJECT = { id: 'p1', teamId: 't1', name: 'Website', goal: '' }

describe('connecting a project to code', () => {
  it('asks the host and returns the connected project', async () => {
    callRuntimeRpc.mockResolvedValue({ project: { ...PROJECT, codeSource: 'repo' } })

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).resolves.toEqual({
      ...PROJECT,
      codeSource: 'repo'
    })
    expect(callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'local' },
      'botTeams.setProjectCodeSource',
      { projectId: 'p1', codeSource: 'repo' }
    )
  })

  it('reads a host without the method as unavailable, not as a failure', async () => {
    callRuntimeRpc.mockRejectedValue(failure('method_not_found'))

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).resolves.toBe('unavailable')
  })

  it('still reports any other failure', async () => {
    callRuntimeRpc.mockRejectedValue(failure('internal_error'))

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).rejects.toThrow('internal_error')
  })

  it('lists a project from an older host as not connected', async () => {
    callRuntimeRpc.mockResolvedValue({ tasks: [], messages: [], projects: [PROJECT] })

    const room = await listBotTeamRoom('t1')

    expect(room.projects).toEqual([{ ...PROJECT, codeSource: null }])
  })
})
