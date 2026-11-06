import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'

function createIntentWith(
  support: Awaited<ReturnType<OrcaRuntimeService['getStructuredAgentSessionCreateSupport']>>
) {
  const runtime = new OrcaRuntimeService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the intent only reads getSettings before it refuses.
    { getSettings: () => ({ agentDefaultEnv: { codex: {} } }) } as never
  )
  vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue(support)
  Object.assign(runtime, {
    resolveRuntimeFileTarget: vi.fn(async () => ({ worktree: { path: '/repos/workspace-1' } }))
  })
  return () =>
    runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: 'id:workspace-1',
      agent: 'codex'
    })
}

describe('a create the host cannot serve', () => {
  it('names why the installed agent cannot run here', async () => {
    const createIntent = createIntentWith({
      supported: false,
      reason: 'agent',
      cause: 'cliMissing'
    })

    await expect(createIntent()).rejects.toMatchObject({
      refusal: { code: 'structured_agent_session_unsupported', details: { reason: 'cliMissing' } }
    })
  })

  it('keeps the generic reason when the check named no cause', async () => {
    const createIntent = createIntentWith({ supported: false, reason: 'remote' })

    await expect(createIntent()).rejects.toMatchObject({
      refusal: {
        code: 'structured_agent_session_unsupported',
        details: { reason: 'hostUnsupported' }
      }
    })
  })
})
