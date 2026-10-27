// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'

const mocks = vi.hoisted(() => ({ call: vi.fn(), discover: vi.fn() }))

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/runtime-git-client', () => ({
  discoverRuntimeCommitMessageModels: mocks.discover
}))
vi.mock('@/runtime/host-model-catalog-snapshots', () => ({
  readHostModelCatalogSnapshot: () => undefined,
  recordHostModelCatalogSnapshot: vi.fn()
}))

import { useCreateChatModelCatalog } from './use-create-chat-model-catalog'

const listed = {
  origin: 'probe',
  fetchedAt: 1,
  models: [{ id: 'opus', label: 'Opus', isDefault: true, efforts: [] }]
}
const LOCAL_CONTEXT: RuntimeGitContext = { settings: null, worktreeId: null, worktreePath: '' }
const SSH_CONTEXT: RuntimeGitContext = {
  settings: null,
  worktreeId: 'repo-ssh::/srv/app',
  worktreePath: '/srv/app',
  connectionId: 'devbox'
}
const agyListing = {
  success: true,
  catalogOrigin: 'probe',
  defaultModelId: 'gemini-4-flash-medium',
  capability: {},
  models: [
    { id: 'gemini-4-flash-low', label: 'Gemini 4 Flash (low)' },
    { id: 'gemini-4-flash-medium', label: 'Gemini 4 Flash (medium)' },
    { id: 'gemini-4-flash-high', label: 'Gemini 4 Flash (high)' }
  ]
}

function render(
  agent: TuiAgent,
  host: ExecutionHostId = 'local',
  context: RuntimeGitContext | null = LOCAL_CONTEXT
) {
  return renderHook(() => useCreateChatModelCatalog(agent, host, context))
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCreateChatModelCatalog', () => {
  it('reads the host catalog of the selected agent', async () => {
    mocks.call.mockResolvedValue(listed)

    const { result } = render('claude')

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.models).toHaveLength(1)
    expect(mocks.call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.modelCatalog', {
      agent: 'claude'
    })
    expect(mocks.discover).not.toHaveBeenCalled()
  })

  it('asks a paired runtime host for its own catalog', async () => {
    mocks.call.mockResolvedValue(listed)

    const { result } = render('codex', 'runtime:env-1', null)

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.call).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'agentSession.modelCatalog',
      { agent: 'codex' }
    )
  })

  it('waits for a listing the host is still running', async () => {
    mocks.call
      .mockResolvedValueOnce({ origin: 'unknown', listingInProgress: true })
      .mockResolvedValueOnce(listed)

    const { result } = render('antigravity')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.call).toHaveBeenLastCalledWith({ kind: 'local' }, 'agentSession.modelCatalog', {
      agent: 'antigravity',
      waitForListing: true
    })
  })

  it('lists Antigravity from its CLI when the host has no catalog, one row per model', async () => {
    mocks.call.mockResolvedValue({ origin: 'unknown' })
    mocks.discover.mockResolvedValue(agyListing)

    const { result } = render('antigravity')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.discover).toHaveBeenCalledWith(LOCAL_CONTEXT, 'antigravity')
    expect(result.current.models).toEqual([
      expect.objectContaining({
        id: 'gemini-4-flash-medium',
        label: 'Gemini 4 Flash',
        defaultEffort: 'medium',
        efforts: [
          { value: 'low', label: 'low' },
          { value: 'medium', label: 'medium' },
          { value: 'high', label: 'high' }
        ]
      })
    ])
  })

  it('lists models on an SSH host through its CLI only', async () => {
    mocks.discover.mockResolvedValue(agyListing)

    const { result } = render('antigravity', 'ssh:devbox', SSH_CONTEXT)

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.call).not.toHaveBeenCalled()
    expect(mocks.discover).toHaveBeenCalledWith(SSH_CONTEXT, 'antigravity')
  })

  it('reports none when neither the host nor the CLI lists models', async () => {
    mocks.call.mockResolvedValueOnce({ origin: 'unknown' }).mockRejectedValueOnce(new Error('no'))
    mocks.discover.mockResolvedValue({ success: false, error: 'missing' })

    const first = render('pi')
    await waitFor(() => expect(first.result.current.status).toBe('none'))

    const second = render('grok', 'runtime:env-1', null)
    await waitFor(() => expect(second.result.current.status).toBe('none'))
  })

  it('goes back to loading for a newly selected agent', async () => {
    mocks.call.mockResolvedValueOnce(listed).mockReturnValueOnce(new Promise(() => {}))

    const { result, rerender } = renderHook(
      ({ agent }: { agent: TuiAgent }) => useCreateChatModelCatalog(agent, 'local', LOCAL_CONTEXT),
      { initialProps: { agent: 'claude' } }
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ agent: 'codex' })

    expect(result.current.status).toBe('loading')
  })
})
