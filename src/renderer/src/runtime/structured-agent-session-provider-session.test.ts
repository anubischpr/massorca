import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  supportsCapability: vi.fn()
}))

vi.mock('./runtime-rpc-client', () => ({
  runtimeEnvironmentSupportsCapability: mocks.supportsCapability
}))

vi.mock('./structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))

import { readStructuredAgentSessionProviderSession } from './structured-agent-session-provider-session'

const SESSION = { key: 'session_id', id: 'claude-session-1' } as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.call.mockResolvedValue({ ok: true, providerSession: SESSION })
  mocks.supportsCapability.mockResolvedValue(true)
})

describe('readStructuredAgentSessionProviderSession', () => {
  it("reads the chat's provider session from its host record with a one-item history page", async () => {
    await expect(
      readStructuredAgentSessionProviderSession({ kind: 'local' }, 'session-1')
    ).resolves.toEqual(SESSION)

    expect(mocks.supportsCapability).not.toHaveBeenCalled()
    expect(mocks.call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.history', {
      sessionId: 'session-1',
      direction: 'tail',
      limit: 1
    })
  })

  it('resolves undefined when the record holds no conversation yet', async () => {
    mocks.call.mockResolvedValue({ ok: true })

    await expect(
      readStructuredAgentSessionProviderSession({ kind: 'local' }, 'session-1')
    ).resolves.toBeUndefined()
  })

  it('refuses to read through a paired host without the structured session surface', async () => {
    mocks.supportsCapability.mockResolvedValue(false)

    await expect(
      readStructuredAgentSessionProviderSession(
        { kind: 'environment', environmentId: 'legacy-env' },
        'session-1'
      )
    ).rejects.toThrow('does not support structured agent sessions')

    expect(mocks.call).not.toHaveBeenCalled()
  })
})
