import { describe, expect, it, vi } from 'vitest'
import { CodexAppServerRequestError } from './codex-app-server-request-error'
import { requestWithPlanTool } from './codex-structured-plan-tool'

const KEY = 'tools.update_plan.enabled'

function refusal(): CodexAppServerRequestError {
  return new CodexAppServerRequestError(
    'thread/start',
    -32600,
    'failed to load configuration: unknown field `update_plan`'
  )
}

describe('requestWithPlanTool', () => {
  const options = () => ({
    threadConfig: { 'x.y': 1 },
    timeoutMs: 10
  })

  it('defaults the plan tool on, keeping the caller config', async () => {
    const request = vi.fn(async () => ({}))
    await requestWithPlanTool({ request }, 'thread/start', { cwd: '/w' }, options())
    expect(request).toHaveBeenCalledWith(
      'thread/start',
      { cwd: '/w', config: { [KEY]: true, 'x.y': 1 } },
      { timeoutMs: 10 }
    )
  })

  it('retries once without the key when the app-server refuses it, then remembers', async () => {
    const connection = {
      request: vi
        .fn<(method: string, params?: Record<string, unknown>) => Promise<unknown>>()
        .mockRejectedValueOnce(refusal())
        .mockResolvedValue({ ok: true })
    }
    await expect(
      requestWithPlanTool(connection, 'thread/start', { cwd: '/w' }, options())
    ).resolves.toEqual({ ok: true })
    expect(connection.request.mock.calls[1]?.[1]).toEqual({ cwd: '/w', config: { 'x.y': 1 } })

    await requestWithPlanTool(connection, 'thread/resume', { cwd: '/w' }, options())
    expect(connection.request).toHaveBeenCalledTimes(3)
    expect(connection.request.mock.calls[2]?.[1]).toEqual({ cwd: '/w', config: { 'x.y': 1 } })
  })

  it('does not retry an unrelated refusal', async () => {
    const request = vi.fn(async () => {
      throw new CodexAppServerRequestError('thread/start', -32600, 'something else')
    })
    await expect(
      requestWithPlanTool({ request }, 'thread/start', { cwd: '/w' }, options())
    ).rejects.toThrow('something else')
    expect(request).toHaveBeenCalledTimes(1)
  })
})
