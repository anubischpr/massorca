import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { REPO_METHODS } from './repo'
import {
  REPO_INIT_GIT_RUNTIME_CAPABILITY,
  RUNTIME_CAPABILITIES
} from '../../../../shared/protocol-version'
import { RPC_PARAMS_BY_METHOD } from '../../../../shared/rpc-contract/rpc-params-catalog.generated'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

function dispatcherFor(runtime: Record<string, unknown>): RpcDispatcher {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: repo.initGit only calls the fixture methods passed in.
  const service = {
    getRuntimeId: () => 'test-runtime',
    ...runtime
  } as unknown as OrcaRuntimeService
  return new RpcDispatcher({ runtime: service, methods: REPO_METHODS })
}

describe('repo.initGit RPC method', () => {
  it('is advertised by capable hosts and listed in the params catalog', () => {
    expect(RUNTIME_CAPABILITIES).toContain(REPO_INIT_GIT_RUNTIME_CAPABILITY)
    expect(REPO_METHODS.map((method) => method.name)).toContain('repo.initGit')
    expect(RPC_PARAMS_BY_METHOD).toHaveProperty('repo.initGit')
  })

  it('initializes Git through the owning runtime and returns the upgraded repo', async () => {
    const repo = { id: 'repo-1', kind: 'git', externalWorktreeVisibility: 'hide' }
    const initializeRepoGit = vi.fn().mockResolvedValue({ ok: true, repo })

    const response = await dispatcherFor({ initializeRepoGit }).dispatch(
      makeRequest('repo.initGit', { repo: 'id:repo-1' })
    )

    expect(initializeRepoGit).toHaveBeenCalledWith('id:repo-1')
    expect(response).toMatchObject({ ok: true, result: { ok: true, repo } })
  })

  it('returns typed refusals as results, not RPC errors', async () => {
    const initializeRepoGit = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'has_folder_workspaces' })

    const response = await dispatcherFor({ initializeRepoGit }).dispatch(
      makeRequest('repo.initGit', { repo: 'id:repo-1' })
    )

    expect(response).toMatchObject({
      ok: true,
      result: { ok: false, error: 'has_folder_workspaces' }
    })
  })

  it('rejects a request without a repo selector', async () => {
    const initializeRepoGit = vi.fn()

    const response = await dispatcherFor({ initializeRepoGit }).dispatch(
      makeRequest('repo.initGit', {})
    )

    expect(response).toMatchObject({ ok: false })
    expect(initializeRepoGit).not.toHaveBeenCalled()
  })

  it('answers method_not_found on a host without the method, which clients read as unsupported', async () => {
    const response = await new RpcDispatcher({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: dispatch fails before the runtime is used.
      runtime: { getRuntimeId: () => 'old-host' } as unknown as OrcaRuntimeService,
      methods: REPO_METHODS.filter((method) => method.name !== 'repo.initGit')
    }).dispatch(makeRequest('repo.initGit', { repo: 'id:repo-1' }))

    expect(response).toMatchObject({ ok: false, error: { code: 'method_not_found' } })
  })
})
