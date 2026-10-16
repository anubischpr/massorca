import { describe, expect, it, vi } from 'vitest'
import { readCodexSessionConnectors } from './codex-session-connectors'

describe('Codex session MCP status', () => {
  it('reads every bounded page for this thread and trusts only runtimeStatus', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { name: 'live', runtimeStatus: 'connected', authStatus: 'unsupported' },
          { name: 'catalog-only', tools: { search: {} }, authStatus: 'oAuth' }
        ],
        nextCursor: 'next'
      })
      .mockResolvedValueOnce({
        data: [
          { name: 'login', runtimeStatus: 'authenticationRequired' },
          { name: 'broken', runtimeStatus: 'failed' }
        ],
        nextCursor: null
      })
    const result = await readCodexSessionConnectors({ request }, 'thread-a', 25)
    expect(result?.servers).toEqual([
      { name: 'live', status: 'connected' },
      { name: 'catalog-only', status: 'unknown' },
      { name: 'login', status: 'needs-auth' },
      { name: 'broken', status: 'failed' }
    ])
    expect(request).toHaveBeenNthCalledWith(
      1,
      'mcpServerStatus/list',
      { threadId: 'thread-a', limit: 100 },
      { timeoutMs: 25 }
    )
    expect(request.mock.calls[1]?.[1]).toMatchObject({ threadId: 'thread-a', cursor: 'next' })
  })
  it('does not present incomplete, malformed or unsupported reads as an empty success', async () => {
    for (const response of [
      null,
      { data: [{ name: 'x' }], nextCursor: 3 },
      { data: [{ name: '' }], nextCursor: null }
    ]) {
      expect(
        await readCodexSessionConnectors({ request: vi.fn().mockResolvedValue(response) }, 't')
      ).toBeUndefined()
    }
    expect(
      await readCodexSessionConnectors(
        { request: vi.fn().mockRejectedValue(new Error('unsupported')) },
        't'
      )
    ).toBeUndefined()
    const request = vi.fn().mockResolvedValue({ data: [], nextCursor: 'loop' })
    expect(await readCodexSessionConnectors({ request }, 't')).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('reports a provider-confirmed empty inventory', async () => {
    expect(
      (
        await readCodexSessionConnectors(
          { request: vi.fn().mockResolvedValue({ data: [], nextCursor: null }) },
          't'
        )
      )?.servers
    ).toEqual([])
  })
})
