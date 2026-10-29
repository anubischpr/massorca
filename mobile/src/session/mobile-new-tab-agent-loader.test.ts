import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { FLOATING_WORKSPACE_WORKTREE_ID } from './floating-workspace'
import { loadMobileNewTabAgentOptions } from './mobile-new-tab-agent-loader'

function createClient(
  handler: (method: string, params?: unknown) => Promise<unknown>
): RpcClient & { sendRequest: ReturnType<typeof vi.fn> } {
  return {
    sendRequest: vi.fn(handler),
    subscribe: vi.fn(() => () => {})
  } as unknown as RpcClient & { sendRequest: ReturnType<typeof vi.fn> }
}

describe('mobile new-tab agent loading', () => {
  it('detects agents locally for the floating workspace without listing repos', async () => {
    const client = createClient(async (method) => {
      if (method === 'settings.get') {
        return {
          ok: true,
          result: { settings: { defaultTuiAgent: 'codex', disabledTuiAgents: [] } }
        }
      }
      if (method === 'preflight.detectAgents') {
        return { ok: true, result: ['claude', 'codex'] }
      }
      throw new Error(`unexpected request: ${method}`)
    })

    await expect(
      loadMobileNewTabAgentOptions({
        client,
        worktreeId: FLOATING_WORKSPACE_WORKTREE_ID
      })
    ).resolves.toEqual([
      { agent: 'codex', label: 'Codex' },
      { agent: 'claude', label: 'Claude' }
    ])
    expect(client.sendRequest.mock.calls.map(([method]) => method)).toEqual([
      'preflight.detectAgents',
      'settings.get'
    ])
  })

  it('detects agents through the worktree repo connection for SSH sessions', async () => {
    const client = createClient(async (method, params) => {
      if (method === 'settings.get') {
        return { ok: true, result: { settings: {} } }
      }
      if (method === 'repo.list') {
        return { ok: true, result: { repos: [{ id: 'repo-1', connectionId: 'ssh-1' }] } }
      }
      if (method === 'preflight.detectRemoteAgents') {
        expect(params).toEqual({ connectionId: 'ssh-1' })
        return { ok: true, result: ['claude'] }
      }
      throw new Error(`unexpected request: ${method}`)
    })

    await expect(
      loadMobileNewTabAgentOptions({
        client,
        worktreeId: 'repo-1::/remote/worktree'
      })
    ).resolves.toEqual([{ agent: 'claude', label: 'Claude' }])
    expect(client.sendRequest.mock.calls.map(([method]) => method)).toEqual([
      'repo.list',
      'settings.get',
      'preflight.detectRemoteAgents'
    ])
  })

  it('asks a local host which Pi runtimes it has once the host reports pi', async () => {
    const client = createClient(async (method) => {
      if (method === 'settings.get') {
        return { ok: true, result: { settings: { defaultTuiAgent: null } } }
      }
      if (method === 'preflight.detectAgents') {
        return { ok: true, result: ['pi'] }
      }
      if (method === 'preflight.detectPiRuntimes') {
        return { ok: true, result: ['gentle-shell'] }
      }
      throw new Error(`unexpected request: ${method}`)
    })

    await expect(
      loadMobileNewTabAgentOptions({ client, worktreeId: FLOATING_WORKSPACE_WORKTREE_ID })
    ).resolves.toEqual([{ agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }])
    expect(client.sendRequest.mock.calls.map(([method]) => method)).toEqual([
      'preflight.detectAgents',
      'settings.get',
      'preflight.detectPiRuntimes'
    ])
  })

  it('asks an SSH host through its connection for its Pi runtimes', async () => {
    const client = createClient(async (method, params) => {
      if (method === 'settings.get') {
        return { ok: true, result: { settings: {} } }
      }
      if (method === 'repo.list') {
        return { ok: true, result: { repos: [{ id: 'repo-1', connectionId: 'ssh-1' }] } }
      }
      if (method === 'preflight.detectRemoteAgents') {
        return { ok: true, result: ['pi'] }
      }
      if (method === 'preflight.detectRemotePiRuntimes') {
        expect(params).toEqual({ connectionId: 'ssh-1' })
        return { ok: true, result: ['pi', 'gentle-shell'] }
      }
      throw new Error(`unexpected request: ${method}`)
    })

    await expect(
      loadMobileNewTabAgentOptions({ client, worktreeId: 'repo-1::/remote/worktree' })
    ).resolves.toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' },
      { agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }
    ])
  })

  it('keeps the single Pi row when the host predates the runtime read', async () => {
    const client = createClient(async (method) => {
      if (method === 'settings.get') {
        return { ok: true, result: { settings: { agentCmdOverrides: { pi: 'pi' } } } }
      }
      if (method === 'preflight.detectAgents') {
        return { ok: true, result: ['pi'] }
      }
      if (method === 'preflight.detectPiRuntimes') {
        throw new Error('method not found: preflight.detectPiRuntimes')
      }
      throw new Error(`unexpected request: ${method}`)
    })

    await expect(
      loadMobileNewTabAgentOptions({ client, worktreeId: FLOATING_WORKSPACE_WORKTREE_ID })
    ).resolves.toEqual([{ agent: 'pi', label: 'Pi', piRuntime: 'pi' }])
  })
})
