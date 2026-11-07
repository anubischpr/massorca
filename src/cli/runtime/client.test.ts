import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeOrchestrationEnvelope } from '../../shared/runtime-rpc-envelope'
import { RuntimeClient } from './client'

const sent = vi.hoisted(() => ({
  calls: [] as { method: string; envelope: RuntimeOrchestrationEnvelope | undefined }[]
}))
vi.mock('./transport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendRequest: async (
    _metadata: unknown,
    method: string,
    _params: unknown,
    _timeoutMs: number,
    envelope?: RuntimeOrchestrationEnvelope
  ) => {
    sent.calls.push({ method, envelope })
    return { id: 'r1', ok: true, result: {}, _meta: { runtimeId: 'runtime-1' } }
  }
}))

const SESSION_ID = '4a1f6c2e-8b3d-4e7a-9c15-0d2b6e8f1a37'

function clientFor(): InstanceType<typeof RuntimeClient> {
  const userDataPath = mkdtempSync(join(tmpdir(), 'orca-client-evidence-'))
  writeFileSync(
    join(userDataPath, 'orca-runtime.json'),
    JSON.stringify({
      runtimeId: 'runtime-1',
      pid: process.pid,
      transports: [{ kind: 'unix', endpoint: join(userDataPath, 'runtime.sock') }],
      authToken: 'token',
      startedAt: Date.now()
    }),
    'utf8'
  )
  return new RuntimeClient(userDataPath, 100, null, null)
}

describe('RuntimeClient caller evidence for methods that start a terminal or an agent', () => {
  beforeEach(() => {
    sent.calls.length = 0
    vi.stubEnv('ORCA_AGENT_SESSION_ID', SESSION_ID)
    vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term_secret_handle')
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each(['terminal.create', 'terminal.split', 'agent.launch'])(
    'sends only the agent session id with %s',
    async (method) => {
      await clientFor().call(method, {})
      expect(sent.calls[0]?.envelope?.orchestrationCompatibilityEvidence).toEqual({
        agentSessionId: SESSION_ID
      })
      expect(sent.calls[0]?.envelope?.compatibilityInvocationId).toBeUndefined()
    }
  )

  it('sends nothing for any other method, so those requests are unchanged', async () => {
    await clientFor().call('terminal.stop', { worktree: 'id:wt' })
    expect(sent.calls[0]?.envelope?.orchestrationCompatibilityEvidence).toBeUndefined()
  })

  it('sends nothing when the CLI runs outside a session', async () => {
    vi.stubEnv('ORCA_AGENT_SESSION_ID', '')
    await clientFor().call('terminal.create', {})
    expect(sent.calls[0]?.envelope?.orchestrationCompatibilityEvidence).toBeUndefined()
  })
})
