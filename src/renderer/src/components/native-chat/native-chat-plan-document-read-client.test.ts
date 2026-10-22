import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-result'
import { readNativeChatPlanDocument } from './native-chat-plan-document-read-client'

const callRuntimeRpc = vi.fn()
vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: (...args: unknown[]) => callRuntimeRpc(...args)
}))

const input = {
  target: { kind: 'local' as const },
  sessionId: 'session-1',
  path: '/brain/c/plan.md'
}

beforeEach(() => callRuntimeRpc.mockReset())

describe('readNativeChatPlanDocument', () => {
  it('returns the text the host served', async () => {
    callRuntimeRpc.mockResolvedValue({
      ok: true,
      revision: 'a'.repeat(32),
      sizeBytes: 2,
      text: '# P'
    })
    expect(await readNativeChatPlanDocument(input)).toEqual({ kind: 'ready', text: '# P' })
    expect(callRuntimeRpc).toHaveBeenCalledWith(
      input.target,
      'agentSession.readPlanDocument',
      { sessionId: 'session-1', path: '/brain/c/plan.md' },
      expect.any(Object)
    )
  })

  it('reads a host refusal as a verdict and an unknown one as unavailable', async () => {
    callRuntimeRpc.mockResolvedValueOnce({ ok: false, error: 'too_large' })
    expect(await readNativeChatPlanDocument(input)).toEqual({ kind: 'refused', error: 'too_large' })
    callRuntimeRpc.mockResolvedValueOnce({ ok: false, error: 'from_the_future' })
    expect(await readNativeChatPlanDocument(input)).toEqual({ kind: 'unavailable' })
  })

  it('says an older host is unsupported, and lost contact is only unavailable', async () => {
    callRuntimeRpc.mockRejectedValueOnce(
      new RuntimeRpcCallError({
        id: '1',
        ok: false,
        error: { code: 'method_not_found', message: 'no method' }
      })
    )
    expect(await readNativeChatPlanDocument(input)).toEqual({ kind: 'unsupported' })
    callRuntimeRpc.mockRejectedValueOnce(new Error('socket closed'))
    expect(await readNativeChatPlanDocument(input)).toEqual({ kind: 'unavailable' })
  })
})
