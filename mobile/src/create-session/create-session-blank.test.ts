import { describe, expect, it, vi } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { launchBlankTerminal } from './create-session-blank'

const repo: MobileWorkspaceRepo = { id: 'web', displayName: 'web', path: '/work/web' }

function ok(result: unknown): RpcResponse {
  return { id: '1', ok: true, result, _meta: { runtimeId: 'r' } }
}

function fakeClient(replies: Record<string, RpcResponse>) {
  const sendRequest = vi.fn(async (method: string, _params?: unknown, _options?: unknown) => {
    return (
      replies[method] ??
      ({
        id: '1',
        ok: false,
        error: { code: 'method_not_found', message: method },
        _meta: { runtimeId: 'r' }
      } satisfies RpcResponse)
    )
  })
  const client: RpcClient = {
    sendRequest,
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
  return { client, sendRequest }
}

const base = { hostId: 'host-1', repo, worktreeCreateIdempotency: Promise.resolve(false as const) }

describe('launchBlankTerminal', () => {
  it('creates a blank worktree with no agent', async () => {
    const { client, sendRequest } = fakeClient({
      'worktree.create': ok({ worktree: { id: 'wt-new', displayName: 'otter' } })
    })
    const result = await launchBlankTerminal({ ...base, client, workspaceMode: 'new-worktree' })
    expect(result).toEqual({ ok: true, worktreeId: 'wt-new', name: 'otter' })
    const params = sendRequest.mock.calls.find(([method]) => method === 'worktree.create')?.[1]
    expect(params).toMatchObject({ repo: 'id:web', setupDecision: 'inherit' })
    expect(params).not.toHaveProperty('startupAgent')
  })

  it('reports the host message when the create is refused', async () => {
    const { client } = fakeClient({})
    const result = await launchBlankTerminal({ ...base, client, workspaceMode: 'new-worktree' })
    expect(result.ok).toBe(false)
  })

  it('opens the existing checkout without creating anything', async () => {
    const { client, sendRequest } = fakeClient({})
    const result = await launchBlankTerminal({ ...base, client, workspaceMode: 'current-checkout' })
    expect(result).toEqual({ ok: true, worktreeId: 'web::/work/web', name: 'web' })
    expect(sendRequest.mock.calls.some(([method]) => method === 'worktree.create')).toBe(false)
  })
})
