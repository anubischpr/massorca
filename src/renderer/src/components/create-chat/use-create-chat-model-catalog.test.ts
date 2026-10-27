// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TuiAgent } from '../../../../shared/tui-agent'

const mocks = vi.hoisted(() => ({ call: vi.fn() }))

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/host-model-catalog-snapshots', () => ({
  readHostModelCatalogSnapshot: () => undefined,
  recordHostModelCatalogSnapshot: vi.fn()
}))

import { useCreateChatModelCatalog } from './use-create-chat-model-catalog'

const listed = {
  origin: 'probe',
  fetchedAt: 1,
  models: [{ id: 'gemini-pro', label: 'Gemini Pro' }]
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCreateChatModelCatalog', () => {
  it('reads the catalog of any agent, not only Claude and Codex', async () => {
    mocks.call.mockResolvedValue(listed)

    const { result } = renderHook(() => useCreateChatModelCatalog('gemini'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.models).toHaveLength(1)
    expect(mocks.call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.modelCatalog', {
      agent: 'gemini'
    })
  })

  it('waits for a listing the host is still running', async () => {
    mocks.call
      .mockResolvedValueOnce({ origin: 'unknown', listingInProgress: true })
      .mockResolvedValueOnce(listed)

    const { result } = renderHook(() => useCreateChatModelCatalog('antigravity'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.call).toHaveBeenLastCalledWith({ kind: 'local' }, 'agentSession.modelCatalog', {
      agent: 'antigravity',
      waitForListing: true
    })
  })

  it('reports none when the host keeps no catalog or refuses the read', async () => {
    mocks.call.mockResolvedValueOnce({ origin: 'unknown' }).mockRejectedValueOnce(new Error('no'))

    const first = renderHook(() => useCreateChatModelCatalog('aider'))
    await waitFor(() => expect(first.result.current.status).toBe('none'))

    const second = renderHook(() => useCreateChatModelCatalog('goose'))
    await waitFor(() => expect(second.result.current.status).toBe('none'))
  })

  it('goes back to loading for a newly selected agent', async () => {
    mocks.call.mockResolvedValueOnce(listed).mockReturnValueOnce(new Promise(() => {}))

    const { result, rerender } = renderHook(
      ({ agent }: { agent: TuiAgent }) => useCreateChatModelCatalog(agent),
      { initialProps: { agent: 'claude' } }
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ agent: 'codex' })

    expect(result.current.status).toBe('loading')
  })
})
